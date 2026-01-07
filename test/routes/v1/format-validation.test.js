'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { build, getRandomTestImage } = require('../../helper')
const FormData = require('form-data')

// Test invalid file mime types
test('POST /v1/resize rejects unsupported image mime type (text/plain)', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const textBuffer = Buffer.from('This is not an image')
  form.append('file', textBuffer, {
    filename: 'test.txt',
    contentType: 'text/plain'
  })
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

  assert.strictEqual(res.statusCode, 415)
  const payload = JSON.parse(res.payload)
  assert.ok(payload.error.message.includes('File must be an image'))
})

test('POST /v1/resize rejects unsupported image mime type (application/pdf)', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const pdfBuffer = Buffer.from('%PDF-1.4 fake pdf')
  form.append('file', pdfBuffer, {
    filename: 'test.pdf',
    contentType: 'application/pdf'
  })
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

  assert.strictEqual(res.statusCode, 415)
  const payload = JSON.parse(res.payload)
  assert.ok(payload.error.message.includes('File must be an image'))
})

test('POST /v1/resize rejects unsupported image format (image/gif)', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const gifBuffer = Buffer.from('GIF89a fake gif')
  form.append('file', gifBuffer, {
    filename: 'test.gif',
    contentType: 'image/gif'
  })
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

  assert.strictEqual(res.statusCode, 415)
  const payload = JSON.parse(res.payload)
  assert.ok(payload.error.message.includes('File must be an image'))
})

test('POST /v1/resize rejects invalid format parameter', async (t) => {
  const app = await build(t)

  const testImage = getRandomTestImage()
  const form = new FormData()
  form.append('file', testImage.buffer, { filename: testImage.filename })
  form.append('width', '400')
  form.append('format', 'png') // Only 'jpg' is supported

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
  assert.ok(payload.error.message.includes('Invalid format'))
})

test('POST /v1/resize rejects invalid format parameter (webp)', async (t) => {
  const app = await build(t)

  const testImage = getRandomTestImage()
  const form = new FormData()
  form.append('file', testImage.buffer, { filename: testImage.filename })
  form.append('width', '400')
  form.append('format', 'webp') // Only 'jpg' is supported

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
  assert.ok(payload.error.message.includes('Invalid format'))
})

test('POST /v1/resize accepts valid JPG format parameter', async (t) => {
  const app = await build(t)

  const testImage = getRandomTestImage()
  const form = new FormData()
  form.append('file', testImage.buffer, { filename: testImage.filename })
  form.append('width', '400')
  form.append('format', 'jpg')

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
})

// Crop endpoint format validation
test('POST /v1/crop rejects unsupported image mime type', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const svgBuffer = Buffer.from('<svg></svg>')
  form.append('file', svgBuffer, {
    filename: 'test.svg',
    contentType: 'image/svg+xml'
  })
  form.append('aspect', '1:1')

  const res = await app.inject({
    method: 'POST',
    url: '/v1/crop',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 415)
  const payload = JSON.parse(res.payload)
  assert.ok(payload.error.message.includes('File must be an image'))
})

test('POST /v1/crop rejects invalid format parameter', async (t) => {
  const app = await build(t)

  const testImage = getRandomTestImage()
  const form = new FormData()
  form.append('file', testImage.buffer, { filename: testImage.filename })
  form.append('aspect', '1:1')
  form.append('format', 'bmp') // Only 'jpg' is supported

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
  const payload = JSON.parse(res.payload)
  assert.ok(payload.error.message.includes('Invalid format'))
})

// Remove-bg endpoint format validation
test('POST /v1/remove-bg rejects unsupported image mime type', async (t) => {
  const app = await build(t)

  const form = new FormData()
  const jsonBuffer = Buffer.from('{"not": "an image"}')
  form.append('file', jsonBuffer, {
    filename: 'test.json',
    contentType: 'application/json'
  })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/remove-bg',
    headers: {
      ...form.getHeaders(),
      'x-api-key': 'test-api-key-123'
    },
    payload: form
  })

  assert.strictEqual(res.statusCode, 415)
  const payload = JSON.parse(res.payload)
  assert.ok(payload.error.message.includes('File must be an image'))
})

test('POST /v1/remove-bg rejects invalid format parameter', async (t) => {
  const app = await build(t)

  const testImage = getRandomTestImage()
  const form = new FormData()
  form.append('file', testImage.buffer, { filename: testImage.filename })
  form.append('format', 'tiff') // Only 'jpg' is supported

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
  const payload = JSON.parse(res.payload)
  assert.ok(payload.error.message.includes('Invalid format'))
})

// Test that all supported mime types are accepted
test('POST /v1/resize accepts image/jpeg mime type', async (t) => {
  const app = await build(t)

  const testImage = getRandomTestImage()
  const form = new FormData()
  form.append('file', testImage.buffer, {
    filename: 'test.jpg',
    contentType: 'image/jpeg'
  })
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
})

test('POST /v1/resize accepts image/png mime type', async (t) => {
  const app = await build(t)

  const testImage = getRandomTestImage()
  const form = new FormData()
  form.append('file', testImage.buffer, {
    filename: 'test.png',
    contentType: 'image/png'
  })
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
})

test('POST /v1/resize accepts image/webp mime type', async (t) => {
  const app = await build(t)

  const testImage = getRandomTestImage()
  const form = new FormData()
  form.append('file', testImage.buffer, {
    filename: 'test.webp',
    contentType: 'image/webp'
  })
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
})
