'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { build } = require('../helper')

test('GET /health returns ok', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    method: 'GET',
    url: '/health'
  })

  assert.strictEqual(res.statusCode, 200)

  const payload = JSON.parse(res.payload)
  assert.strictEqual(payload.ok, true)
})

test('GET /health includes AGPL compliance headers', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    method: 'GET',
    url: '/health'
  })

  assert.ok(res.headers['x-source-code'], 'X-Source-Code header should be present')
  assert.ok(res.headers['x-request-id'], 'X-Request-Id header should be present')
})
