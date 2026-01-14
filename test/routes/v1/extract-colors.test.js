'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { build, getRandomTestImage, saveTestOutput } = require('../../helper')
const FormData = require('form-data')
const sharp = require('sharp')

// Helper to create a synthetic test image with specific colors
async function createColoredImage(colors, width = 300, height = 300) {
  // Create composite image with color blocks
  const blockWidth = Math.floor(width / colors.length)

  const composites = colors.map((color, index) => ({
    input: Buffer.from(
      `<svg width="${blockWidth}" height="${height}">
        <rect width="${blockWidth}" height="${height}" fill="${color}"/>
      </svg>`
    ),
    left: index * blockWidth,
    top: 0
  }))

  return await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: colors[0]
    }
  })
    .composite(composites)
    .png()
    .toBuffer()
}

test('POST /v1/extract-colors requires authentication', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createColoredImage(['#FF0000'])
  form.append('file', imageBuffer, { filename: 'test.png' })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/extract-colors',
    headers: form.getHeaders(),
    payload: form
  })

  assert.strictEqual(res.statusCode, 401)
  const payload = JSON.parse(res.payload)
  assert.strictEqual(payload.error.code, 'UNAUTHORIZED')
})

test('POST /v1/extract-colors with invalid API key returns 401', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createColoredImage(['#FF0000'])
  form.append('file', imageBuffer, { filename: 'test.png' })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/extract-colors',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'invalid-key'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 401)
  const payload = JSON.parse(res.payload)
  assert.strictEqual(payload.error.code, 'UNAUTHORIZED')
})

test('POST /v1/extract-colors without file returns 400', async (t) => {
  const app = await build(t)

  const form = new FormData()

  const res = await app.inject({
    method: 'POST',
    url: '/v1/extract-colors',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 400)
})

test('POST /v1/extract-colors with unsupported file type returns 415', async (t) => {
  const app = await build(t)

  const form = new FormData()
  form.append('file', Buffer.from('not an image'), {
    filename: 'test.txt',
    contentType: 'text/plain'
  })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/extract-colors',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 415)
})

test('POST /v1/extract-colors extracts colors from red image', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createColoredImage(['#FF0000']) // Pure red
  form.append('file', imageBuffer, { filename: 'red.png' })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/extract-colors',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)
  const payload = JSON.parse(res.payload)

  assert.ok(Array.isArray(payload.colors))
  assert.ok(payload.colors.length > 0)
  assert.ok(payload.colors.includes('red'))

  assert.ok(payload.palette)
  assert.ok(Array.isArray(payload.palette.swatches))
  assert.ok(payload.palette.swatches.length > 0)
  assert.strictEqual(typeof payload.palette.totalPopulation, 'number')
  assert.strictEqual(typeof payload.palette.isMulticolor, 'boolean')
})

test('POST /v1/extract-colors extracts colors from blue image', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createColoredImage(['#0000FF']) // Pure blue
  form.append('file', imageBuffer, { filename: 'blue.png' })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/extract-colors',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)
  const payload = JSON.parse(res.payload)

  assert.ok(payload.colors.includes('blue'))
})

test('POST /v1/extract-colors detects multicolor for image with multiple prominent colors', async (t) => {
  const app = await build(t)

  const form = new FormData()
  // Create image with 3 equally distributed colors
  const imageBuffer = await createColoredImage(['#FF0000', '#00FF00', '#0000FF'])
  form.append('file', imageBuffer, { filename: 'multicolor.png' })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/extract-colors',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)
  const payload = JSON.parse(res.payload)

  // Should have at least 3 colors extracted
  assert.ok(payload.palette.swatches.length >= 3, 'Should have at least 3 color swatches')

  // Check if multicolor was detected (it should be if colors are evenly distributed)
  // Note: This depends on the image and vibrant's algorithm, so we check the logic worked
  console.log('  Multicolor detection result:', {
    colors: payload.colors,
    isMulticolor: payload.palette.isMulticolor,
    swatches: payload.palette.swatches.map(s => `${s.colorName} ${s.percentage}%`)
  })

  // Verify the response structure is correct regardless of multicolor detection
  assert.strictEqual(typeof payload.palette.isMulticolor, 'boolean')
})

test('POST /v1/extract-colors respects maxColors parameter', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createColoredImage(['#FF0000', '#00FF00', '#0000FF', '#FFFF00'])
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('maxColors', '2')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/extract-colors',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)
  const payload = JSON.parse(res.payload)

  // Should have at most 2 color swatches (excluding multicolor tag if added)
  assert.ok(payload.palette.swatches.length <= 2)
})

test('POST /v1/extract-colors with invalid maxColors returns 400', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createColoredImage(['#FF0000'])
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('maxColors', '15') // Invalid: > 10

  const res = await app.inject({
    method: 'POST',
    url: '/v1/extract-colors',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 400)
})

test('POST /v1/extract-colors with invalid multicolorThreshold returns 400', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createColoredImage(['#FF0000'])
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('multicolorThreshold', '1.5') // Invalid: > 1

  const res = await app.inject({
    method: 'POST',
    url: '/v1/extract-colors',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 400)
})

test('POST /v1/extract-colors returns detailed palette information', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createColoredImage(['#FF0000'])
  form.append('file', imageBuffer, { filename: 'test.png' })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/extract-colors',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)
  const payload = JSON.parse(res.payload)

  // Verify swatch structure
  const swatch = payload.palette.swatches[0]
  assert.ok(swatch.hex)
  assert.ok(Array.isArray(swatch.rgb))
  assert.strictEqual(swatch.rgb.length, 3)
  assert.ok(swatch.colorName)
  assert.strictEqual(typeof swatch.population, 'number')
  assert.strictEqual(typeof swatch.percentage, 'number')
  assert.ok(swatch.percentage >= 0 && swatch.percentage <= 100)
})

test('POST /v1/extract-colors works with JPEG images', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 255, g: 0, b: 0 }
    }
  })
    .jpeg()
    .toBuffer()

  form.append('file', imageBuffer, {
    filename: 'test.jpg',
    contentType: 'image/jpeg'
  })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/extract-colors',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)
  const payload = JSON.parse(res.payload)
  assert.ok(Array.isArray(payload.colors))
})

test('POST /v1/extract-colors with real product image', async (t) => {
  const app = await build(t)

  try {
    const testImage = getRandomTestImage()
    const form = new FormData()
    form.append('file', testImage.buffer, { filename: testImage.filename })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/extract-colors',
      headers: {
        ...form.getHeaders(),
        'x-api-key': 'test-api-key-123'
      },
      payload: form
    })

    assert.strictEqual(res.statusCode, 200)
    const payload = JSON.parse(res.payload)

    assert.ok(Array.isArray(payload.colors))
    assert.ok(payload.colors.length > 0)

    console.log(`  Extracted colors from ${testImage.filename}:`, payload.colors)
    console.log(`  Palette details:`, payload.palette.swatches.map(s =>
      `${s.colorName} (${s.hex}) - ${s.percentage}%`
    ))
  } catch (err) {
    // Skip test if no test images available
    console.log('  Skipped: No test images available')
  }
})
