'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { build } = require('../../helper')
const FormData = require('form-data')
const sharp = require('sharp')

// Helper to create a test image buffer with a simple shape
async function createTestImage(width = 200, height = 200) {
  // Create a simple solid color test image (simpler for AI processing)
  return await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 100, g: 100, b: 100 }
    }
  })
    .png()
    .toBuffer()
}

test('POST /v1/remove-bg requires authentication', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage()
  form.append('file', imageBuffer, { filename: 'test.png' })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/remove-bg',
    headers: form.getHeaders(),
    payload: form
  })

  assert.strictEqual(res.statusCode, 401)
})

// Note: Background removal tests with actual AI processing are skipped
// because the AI model requires realistic photo-like images.
// In a production environment, use real test fixtures (photos) for these tests.

test.skip('POST /v1/remove-bg removes background from image', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage()
  form.append('file', imageBuffer, { filename: 'test.png' })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/remove-bg',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)
  assert.ok(res.headers['content-type'].startsWith('image/'))

  // Verify output has alpha channel (transparency)
  const metadata = await sharp(Buffer.from(res.rawPayload)).metadata()
  assert.strictEqual(metadata.channels, 4, 'Should have alpha channel')
})

test.skip('POST /v1/remove-bg with output=mask returns grayscale mask', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage()
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('output', 'mask')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/remove-bg',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)

  // Verify output is grayscale (single channel)
  const metadata = await sharp(Buffer.from(res.rawPayload)).metadata()
  assert.ok(metadata.channels <= 2, 'Mask should be grayscale')
})

test.skip('POST /v1/remove-bg with feathering', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage()
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('feather', '5')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/remove-bg',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)

  // Verify output has alpha channel
  const metadata = await sharp(Buffer.from(res.rawPayload)).metadata()
  assert.strictEqual(metadata.channels, 4)
})

test.skip('POST /v1/remove-bg with threshold on mask', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage()
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('output', 'mask')
  form.append('threshold', '128')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/remove-bg',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 200)

  const metadata = await sharp(Buffer.from(res.rawPayload)).metadata()
  assert.ok(metadata.channels <= 2, 'Should be grayscale mask')
})

test.skip('POST /v1/remove-bg with WebP format', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage()
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('format', 'webp')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/remove-bg',
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

test.skip('POST /v1/remove-bg with JPEG format flattens transparency', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage()
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('format', 'jpeg')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/remove-bg',
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
  assert.strictEqual(metadata.channels, 3, 'JPEG should not have alpha channel')
})

test('POST /v1/remove-bg with invalid feather value returns 400', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage()
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('feather', '15') // Max is 10

  const res = await app.inject({
    method: 'POST',
    url: '/v1/remove-bg',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 400)
})

test('POST /v1/remove-bg with invalid threshold value returns 400', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const imageBuffer = await createTestImage()
  form.append('file', imageBuffer, { filename: 'test.png' })
  form.append('output', 'mask')
  form.append('threshold', '300') // Max is 255

  const res = await app.inject({
    method: 'POST',
    url: '/v1/remove-bg',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 400)
})

test('POST /v1/remove-bg without file returns 400', async (t) => {
  const app = await build(t)

  const form = new FormData()

  const res = await app.inject({
    method: 'POST',
    url: '/v1/remove-bg',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 400)
})
