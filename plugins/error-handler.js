'use strict'

const fp = require('fastify-plugin')

/**
 * Error Handler Plugin
 * Provides consistent error response format matching the OpenAPI spec
 */
module.exports = fp(async function (fastify, opts) {
  fastify.setErrorHandler(async (error, request, reply) => {
    // Log the error
    fastify.log.error(error)

    // Default error response
    let statusCode = error.statusCode || 500
    let errorCode = 'INTERNAL'
    let errorMessage = error.message || 'Internal server error'

    // Map common Fastify/HTTP errors to API error codes
    if (error.validation) {
      statusCode = 400
      errorCode = 'INVALID_INPUT'
      errorMessage = error.message
    } else if (statusCode === 400) {
      errorCode = 'INVALID_INPUT'
    } else if (statusCode === 401) {
      errorCode = 'UNAUTHORIZED'
    } else if (statusCode === 413) {
      errorCode = 'PAYLOAD_TOO_LARGE'
    } else if (statusCode === 415) {
      errorCode = 'UNSUPPORTED_MEDIA_TYPE'
    } else if (statusCode === 429) {
      errorCode = 'RATE_LIMITED'
    }

    // Send error response in spec format
    reply.code(statusCode).send({
      error: {
        code: errorCode,
        message: errorMessage
      }
    })
  })

  // Note: httpErrors decorator is provided by @fastify/sensible
  // Use fastify.httpErrors.createError(statusCode, message) for custom errors
})
