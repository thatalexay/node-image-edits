'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { build } = require('../helper')

test('GET /source returns source code information', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    method: 'GET',
    url: '/source'
  })

  assert.strictEqual(res.statusCode, 200)

  const payload = JSON.parse(res.payload)
  assert.strictEqual(payload.name, 'node-image-editing')
  assert.strictEqual(payload.version, '0.1.0')
  assert.strictEqual(payload.license, 'AGPL-3.0-or-later')
  assert.ok(payload.source, 'Source URL should be present')
})

test('GET /source includes AGPL compliance headers', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    method: 'GET',
    url: '/source'
  })

  assert.ok(res.headers['x-source-code'], 'X-Source-Code header should be present')
  assert.ok(res.headers['x-request-id'], 'X-Request-Id header should be present')
})
