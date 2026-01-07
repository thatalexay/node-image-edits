'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { build, getRandomTestImage, saveTestOutput } = require('../../helper')
const FormData = require('form-data')
const sharp = require('sharp')

// Helper to create a synthetic test image (for specific dimension tests)
async function createTestImage(width = 800, height = 600) {
  return await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 }
    }
  })
    .png()
    .toBuffer()
}

test('POST /v1/resize requires authentication', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage()
  form.append('file', imageBuffer, { filename: 'test.png' })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/resize',
    headers: form.getHeaders(),
    payload: form
  })

  assert.strictEqual(res.statusCode, 401)
  const payload = JSON.parse(res.payload)
  assert.strictEqual(payload.error.code, 'UNAUTHORIZED')
})

test('POST /v1/resize with invalid API key returns 401', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage()
  form.append('file', imageBuffer, { filename: 'test.png' })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/resize',
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

test('POST /v1/resize resizes image to specified dimensions', async (t) => {
  const app = await build(t)

  const testImage = getRandomTestImage()
  const form = new FormData()
  form.append('file', testImage.buffer, { filename: testImage.filename })
  form.append('width', '400')
  form.append('height', '300')
  form.append('fit', 'inside')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/resize',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)
  assert.ok(res.headers['content-type'].startsWith('image/'))

  // Save output for visual inspection
  const outputBuffer = Buffer.from(res.rawPayload)
  saveTestOutput(outputBuffer, 'resize-400x300', 'jpg')

  // Verify the output image dimensions
  const metadata = await sharp(outputBuffer).metadata()
  assert.strictEqual(metadata.format, 'jpeg')
  assert.ok(metadata.width <= 400, 'Width should be <= 400')
  assert.ok(metadata.height <= 300, 'Height should be <= 300')
})

test('POST /v1/resize with only width maintains aspect ratio', async (t) => {
  const app = await build(t)

  const testImage = getRandomTestImage()
  const form = new FormData()
  form.append('file', testImage.buffer, { filename: testImage.filename })
  form.append('width', '400')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/resize',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)

  // Save output for visual inspection
  const outputBuffer = Buffer.from(res.rawPayload)
  saveTestOutput(outputBuffer, 'resize-width-only', 'jpg')

  const metadata = await sharp(outputBuffer).metadata()
  assert.strictEqual(metadata.format, 'jpeg')
  assert.strictEqual(metadata.width, 400)
})

test('POST /v1/resize with fit=cover crops to fill dimensions', async (t) => {
  const app = await build(t)

  const testImage = getRandomTestImage()
  const form = new FormData()
  form.append('file', testImage.buffer, { filename: testImage.filename })
  form.append('width', '400')
  form.append('height', '400')
  form.append('fit', 'cover')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/resize',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)

  // Save output for visual inspection
  const outputBuffer = Buffer.from(res.rawPayload)
  saveTestOutput(outputBuffer, 'resize-cover-400x400', 'jpg')

  const metadata = await sharp(outputBuffer).metadata()
  assert.strictEqual(metadata.format, 'jpeg')
  assert.strictEqual(metadata.width, 400)
  assert.strictEqual(metadata.height, 400)
})

test('POST /v1/resize with JPEG quality parameter', async (t) => {
  const app = await build(t)

  const testImage = getRandomTestImage()
  const form = new FormData()
  form.append('file', testImage.buffer, { filename: testImage.filename })
  form.append('width', '400')
  form.append('format', 'jpg')
  form.append('quality', '90')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/resize',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.headers['content-type'], 'image/jpeg')

  // Save output for visual inspection
  const outputBuffer = Buffer.from(res.rawPayload)
  saveTestOutput(outputBuffer, 'resize-jpeg-quality90', 'jpg')

  const metadata = await sharp(outputBuffer).metadata()
  assert.strictEqual(metadata.format, 'jpeg')
})

test('POST /v1/resize with invalid dimensions returns 400', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage()
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('width', '-100')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/resize',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 400)
  const payload = JSON.parse(res.payload)
  assert.strictEqual(payload.error.code, 'INVALID_INPUT')
})

test('POST /v1/resize without file returns 400', async (t) => {
  const app = await build(t)

  const form = new FormData()
  form.append('width', '400')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/resize',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 400)
})
