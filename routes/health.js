'use strict'

/**
 * Health Check Route
 * GET /health - Returns service health status (unauthenticated)
 */
module.exports = async function (fastify, opts) {
  fastify.get('/health', {
    schema: {
      tags: ['meta'],
      response: {
        200: {
          type: 'object',
          required: ['ok'],
          properties: {
            ok: { type: 'boolean' }
          }
        }
      }
    }
  }, async (request, reply) => {
    return { ok: true }
  })
}
