'use strict'

const fp = require('fastify-plugin')

/**
 * Support Plugin
 * Registers core Fastify plugins (CORS, multipart, helmet, rate-limit, env)
 */
module.exports = fp(async function (fastify, opts) {
  // Environment variables configuration
  await fastify.register(require('@fastify/env'), {
    confKey: 'config',
    schema: {
      type: 'object',
      required: ['API_KEYS'],
      properties: {
        API_KEYS: {
          type: 'string',
          description: 'Comma-separated list of valid API keys'
        },
        SOURCE_CODE_URL: {
          type: 'string',
          default: 'https://github.com/your-org/node-image-editing'
        },
        MAX_FILE_SIZE: {
          type: 'number',
          default: 10485760 // 10MB in bytes
        },
        RATE_LIMIT_MAX: {
          type: 'number',
          default: 100
        },
        RATE_LIMIT_TIMEWINDOW: {
          type: 'string',
          default: '1 minute'
        }
      }
    },
    dotenv: true
  })

  // CORS support
  await fastify.register(require('@fastify/cors'), {
    origin: true // Allow all origins in development; configure for production
  })

  // Security headers
  await fastify.register(require('@fastify/helmet'), {
    contentSecurityPolicy: false // Disable CSP for API service
  })

  // Multipart file uploads
  await fastify.register(require('@fastify/multipart'), {
    limits: {
      fileSize: fastify.config.MAX_FILE_SIZE,
      files: 1 // Only one file per upload for image operations
    }
  })

  // Rate limiting
  await fastify.register(require('@fastify/rate-limit'), {
    max: fastify.config.RATE_LIMIT_MAX,
    timeWindow: fastify.config.RATE_LIMIT_TIMEWINDOW,
    errorResponseBuilder: (request, context) => {
      return {
        error: {
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded. Try again in ${context.after}`
        }
      }
    }
  })
})
