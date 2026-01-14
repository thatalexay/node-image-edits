'use strict'

const classificationService = require('../../services/classification-service')

/**
 * Classify Clothing Route
 * POST /v1/classify-clothing - Classify clothing items into categories using AI
 */
module.exports = async function (fastify, opts) {
  fastify.post('/classify-clothing', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['image', 'ai'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['tops', 'bottoms', 'shoes', 'outerwear', 'accessories'],
              description: 'Classified clothing category'
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        },
        415: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Parse multipart form data
      const data = await request.file()

      if (!data) {
        throw fastify.httpErrors.createError(400, 'Missing file in request')
      }

      // Validate file type
      const mimeType = data.mimetype
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
      if (!mimeType || !allowedMimeTypes.includes(mimeType)) {
        throw fastify.httpErrors.createError(415, 'File must be an image (jpg, png, webp, heic)')
      }

      // Classify the clothing item
      const result = await classificationService.classify(data)

      return result
    } catch (error) {
      if (error.statusCode) throw error
      fastify.log.error(error)
      throw new Error('Failed to classify clothing item')
    }
  })
}
