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

  const form = new FormData()
  const imageBuffer = await createTestImage(800, 600)
  form.append('file', imageBuffer, { filename: 'test.png' })
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

  // Verify the output image dimensions
  const metadata = await sharp(Buffer.from(res.rawPayload)).metadata()
  assert.strictEqual(metadata.width, 400)
  assert.strictEqual(metadata.height, 300)
})

test('POST /v1/resize with only width maintains aspect ratio', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage(800, 600)
  form.append('file', imageBuffer, { filename: 'test.png' })
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

  const metadata = await sharp(Buffer.from(res.rawPayload)).metadata()
  assert.strictEqual(metadata.width, 400)
  assert.strictEqual(metadata.height, 300) // Maintains 4:3 aspect ratio
})

test('POST /v1/resize with fit=cover crops to fill dimensions', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage(800, 600)
  form.append('file', imageBuffer, { filename: 'test.png' })
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

  const metadata = await sharp(Buffer.from(res.rawPayload)).metadata()
  assert.strictEqual(metadata.width, 400)
  assert.strictEqual(metadata.height, 400)
})

test('POST /v1/resize converts format to JPEG', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage()
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('width', '400')
  form.append('format', 'jpeg')
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

  const metadata = await sharp(Buffer.from(res.rawPayload)).metadata()
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
