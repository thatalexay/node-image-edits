'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { build } = require('../../helper')
const FormData = require('form-data')
const sharp = require('sharp')

// Helper to create a test image buffer
async function createTestImage(width = 800, height = 600) {
  return await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 0, g: 255, b: 0 }
    }
  })
    .png()
    .toBuffer()
}

test('POST /v1/crop requires authentication', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage()
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('x', '0')
  form.append('y', '0')
  form.append('width', '400')
  form.append('height', '400')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/crop',
    headers: form.getHeaders(),
    payload: form
  })

  assert.strictEqual(res.statusCode, 401)
})

test('POST /v1/crop with rectangle coordinates', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage(800, 600)
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('x', '100')
  form.append('y', '100')
  form.append('width', '400')
  form.append('height', '300')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/crop',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)
  assert.ok(res.headers['content-type'].startsWith('image/'))

  const metadata = await sharp(Buffer.from(res.rawPayload)).metadata()
  assert.strictEqual(metadata.width, 400)
  assert.strictEqual(metadata.height, 300)
})

test('POST /v1/crop with aspect ratio 1:1', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage(800, 600)
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('aspect', '1:1')
  form.append('gravity', 'center')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/crop',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)

  const metadata = await sharp(Buffer.from(res.rawPayload)).metadata()
  assert.strictEqual(metadata.width, metadata.height, 'Should be square')
  assert.strictEqual(metadata.height, 600) // Height of original image
})

test('POST /v1/crop with aspect ratio 16:9', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage(1920, 1080)
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('aspect', '16:9')
  form.append('gravity', 'center')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/crop',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)

  const metadata = await sharp(Buffer.from(res.rawPayload)).metadata()
  const aspectRatio = metadata.width / metadata.height
  assert.ok(Math.abs(aspectRatio - (16/9)) < 0.01, 'Should be 16:9 aspect ratio')
})

test('POST /v1/crop with gravity=north', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage(800, 1200)
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('aspect', '1:1')
  form.append('gravity', 'north')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/crop',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)

  const metadata = await sharp(Buffer.from(res.rawPayload)).metadata()
  assert.strictEqual(metadata.width, 800)
  assert.strictEqual(metadata.height, 800)
})

test('POST /v1/crop with gravity=west', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage(1200, 800)
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('aspect', '1:1')
  form.append('gravity', 'west')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/crop',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)

  const metadata = await sharp(Buffer.from(res.rawPayload)).metadata()
  assert.strictEqual(metadata.width, 800)
  assert.strictEqual(metadata.height, 800)
})

test('POST /v1/crop converts format to WebP', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage()
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('aspect', '1:1')
  form.append('format', 'webp')
  form.append('quality', '85')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/crop',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.headers['content-type'], 'image/webp')

  const metadata = await sharp(Buffer.from(res.rawPayload)).metadata()
  assert.strictEqual(metadata.format, 'webp')
})

test('POST /v1/crop with invalid crop region returns error', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage(800, 600)
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('x', '900') // Out of bounds
  form.append('y', '0')
  form.append('width', '400')
  form.append('height', '300')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/crop',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  // Sharp will throw an error for out of bounds crop
  assert.ok(res.statusCode >= 400, 'Should return an error status code')
})

test('POST /v1/crop without crop parameters returns 400', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage()
  form.append('file', imageBuffer, { filename: 'test.png' })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/crop',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 400)
})
