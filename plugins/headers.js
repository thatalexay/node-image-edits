'use strict'

const fp = require('fastify-plugin')

/**
 * Response Headers Plugin
 * Adds X-Source-Code and X-Request-Id headers to all responses (AGPL compliance)
 */
module.exports = fp(async function (fastify, opts) {
  fastify.addHook('onRequest', async (request, reply) => {
    // Capture X-Request-Id from client if provided
    const requestId = request.headers['x-request-id'] || request.id
    request.requestId = requestId
  })

  fastify.addHook('onSend', async (request, reply, payload) => {
    // Add AGPL compliance header with source code URL
    const sourceUrl = process.env.SOURCE_CODE_URL || 'https://github.com/your-org/node-image-editing'
    reply.header('X-Source-Code', sourceUrl)

    // Echo back request ID for correlation
    reply.header('X-Request-Id', request.requestId)

    return payload
  })
})
