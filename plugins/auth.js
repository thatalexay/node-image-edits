'use strict'

const fp = require('fastify-plugin')

/**
 * API Key Authentication Plugin
 * Validates X-Api-Key header against configured API keys
 */
module.exports = fp(async function (fastify, opts) {
  fastify.decorate('authenticate', async function (request, reply) {
    const apiKey = request.headers['x-api-key']

    if (!apiKey) {
      return reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing X-Api-Key header'
        }
      })
    }

    // Get valid API keys from environment (comma-separated list)
    const validApiKeys = process.env.API_KEYS?.split(',').map(k => k.trim()) || []

    if (validApiKeys.length === 0) {
      fastify.log.warn('No API keys configured! All requests will be rejected.')
    }

    if (!validApiKeys.includes(apiKey)) {
      return reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid API key'
        }
      })
    }
  })
})
