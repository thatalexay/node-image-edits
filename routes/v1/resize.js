'use strict'

const imageService = require('../../services/image-service')

/**
 * Resize Image Route
 * POST /v1/resize - Resize an image with various fit options
 */
module.exports = async function (fastify, opts) {
  fastify.post('/resize', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['image'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'string',
          format: 'binary'
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

      // Get form fields
      const width = data.fields.width?.value ? parseInt(data.fields.width.value) : undefined
      const height = data.fields.height?.value ? parseInt(data.fields.height.value) : undefined
      const fit = data.fields.fit?.value || 'inside'
      const format = data.fields.format?.value
      const quality = data.fields.quality?.value ? parseInt(data.fields.quality.value) : undefined
      const background = data.fields.background?.value

      // Validate inputs
      if (!width && !height) {
        throw fastify.httpErrors.createError(400, 'Either width or height must be provided')
      }

      if (width && width < 1) {
        throw fastify.httpErrors.createError(400, 'Width must be at least 1')
      }

      if (height && height < 1) {
        throw fastify.httpErrors.createError(400, 'Height must be at least 1')
      }

      const validFits = ['cover', 'contain', 'fill', 'inside', 'outside']
      if (!validFits.includes(fit)) {
        throw fastify.httpErrors.createError(400, `Invalid fit. Must be one of: ${validFits.join(', ')}`)
      }

      const validFormats = ['png', 'jpeg', 'webp']
      if (format && !validFormats.includes(format)) {
        throw fastify.httpErrors.createError(400, `Invalid format. Must be one of: ${validFormats.join(', ')}`)
      }

      if (quality && (quality < 1 || quality > 100)) {
        throw fastify.httpErrors.createError(400, 'Quality must be between 1 and 100')
      }

      if (background && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(background)) {
        throw fastify.httpErrors.createError(400, 'Background must be a valid hex color (e.g., #ffffff)')
      }

      // Validate file type
      const mimeType = data.mimetype
      if (!mimeType || !mimeType.startsWith('image/')) {
        throw fastify.httpErrors.createError(415, 'File must be an image')
      }

      // Process the image
      const result = await imageService.resize(data, {
        width,
        height,
        fit,
        format,
        quality,
        background
      })

      // Set appropriate content type
      const outputFormat = format || (mimeType.includes('png') ? 'png' :
                                      mimeType.includes('webp') ? 'webp' : 'jpeg')
      reply.type(`image/${outputFormat}`)

      return result.buffer
    } catch (error) {
      if (error.statusCode) throw error
      fastify.log.error(error)
      throw new Error('Failed to process image')
    }
  })
}
