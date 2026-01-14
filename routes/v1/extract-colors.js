'use strict'

const imageService = require('../../services/image-service')

/**
 * Extract Colors Route
 * POST /v1/extract-colors - Extract prominent colors from an image and return color names
 */
module.exports = async function (fastify, opts) {
  fastify.post('/extract-colors', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['image'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            colors: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of prominent color names (e.g., ["red", "blue", "multicolor"])'
            },
            palette: {
              type: 'object',
              properties: {
                swatches: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      hex: { type: 'string' },
                      rgb: {
                        type: 'array',
                        items: { type: 'number' }
                      },
                      colorName: { type: 'string' },
                      population: { type: 'number' },
                      percentage: { type: 'number' }
                    }
                  }
                },
                totalPopulation: { type: 'number' },
                isMulticolor: { type: 'boolean' }
              }
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

      // Get optional form fields
      const maxColors = data.fields.maxColors?.value ? parseInt(data.fields.maxColors.value) : 3
      const multicolorThreshold = data.fields.multicolorThreshold?.value
        ? parseFloat(data.fields.multicolorThreshold.value)
        : 0.20

      // Validate inputs
      if (maxColors < 1 || maxColors > 10) {
        throw fastify.httpErrors.createError(400, 'maxColors must be between 1 and 10')
      }

      if (multicolorThreshold < 0 || multicolorThreshold > 1) {
        throw fastify.httpErrors.createError(400, 'multicolorThreshold must be between 0 and 1')
      }

      // Validate file type
      const mimeType = data.mimetype
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
      if (!mimeType || !allowedMimeTypes.includes(mimeType)) {
        throw fastify.httpErrors.createError(415, 'File must be an image (jpg, png, webp, heic)')
      }

      // Extract colors from the image
      const result = await imageService.extractColors(data, {
        maxColors,
        multicolorThreshold
      })

      return result
    } catch (error) {
      if (error.statusCode) throw error
      fastify.log.error(error)
      throw new Error('Failed to extract colors from image')
    }
  })
}
