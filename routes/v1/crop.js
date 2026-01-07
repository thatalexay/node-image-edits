'use strict'

const imageService = require('../../services/image-service')

/**
 * Crop Image Route
 * POST /v1/crop - Crop an image using rectangle or aspect ratio
 */
module.exports = async function (fastify, opts) {
  fastify.post('/crop', {
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

      // Get form fields for rectangle crop
      const x = data.fields.x?.value ? parseInt(data.fields.x.value) : undefined
      const y = data.fields.y?.value ? parseInt(data.fields.y.value) : undefined
      const width = data.fields.width?.value ? parseInt(data.fields.width.value) : undefined
      const height = data.fields.height?.value ? parseInt(data.fields.height.value) : undefined

      // Get form fields for aspect ratio crop
      const aspect = data.fields.aspect?.value
      const gravity = data.fields.gravity?.value || 'center'

      // Get output options
      const format = data.fields.format?.value
      const quality = data.fields.quality?.value ? parseInt(data.fields.quality.value) : undefined

      // Validate crop mode
      const hasRectCrop = x !== undefined || y !== undefined || width !== undefined || height !== undefined
      const hasAspectCrop = aspect !== undefined

      if (!hasRectCrop && !hasAspectCrop) {
        throw fastify.httpErrors.createError(400, 'Either rectangle crop (x, y, width, height) or aspect crop (aspect) must be provided')
      }

      // Validate rectangle crop
      if (hasRectCrop) {
        if (x === undefined || y === undefined || width === undefined || height === undefined) {
          throw fastify.httpErrors.createError(400, 'Rectangle crop requires all of: x, y, width, height')
        }
        if (x < 0 || y < 0) {
          throw fastify.httpErrors.createError(400, 'x and y must be >= 0')
        }
        if (width < 1 || height < 1) {
          throw fastify.httpErrors.createError(400, 'width and height must be >= 1')
        }
      }

      // Validate aspect crop
      if (hasAspectCrop && !hasRectCrop) {
        if (!/^[0-9]+:[0-9]+$/.test(aspect)) {
          throw fastify.httpErrors.createError(400, 'Aspect must be in format "width:height" (e.g., "16:9")')
        }

        const validGravities = ['center', 'north', 'south', 'east', 'west']
        if (!validGravities.includes(gravity)) {
          throw fastify.httpErrors.createError(400, `Invalid gravity. Must be one of: ${validGravities.join(', ')}`)
        }
      }

      // Validate output format
      const validFormats = ['jpg']
      if (format && !validFormats.includes(format)) {
        throw fastify.httpErrors.createError(400, `Invalid format. Must be one of: ${validFormats.join(', ')}`)
      }

      if (quality && (quality < 1 || quality > 100)) {
        throw fastify.httpErrors.createError(400, 'Quality must be between 1 and 100')
      }

      // Validate file type
      const mimeType = data.mimetype
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
      if (!mimeType || !allowedMimeTypes.includes(mimeType)) {
        throw fastify.httpErrors.createError(415, 'File must be an image (jpg, png, webp, heic)')
      }

      // Process the image
      const result = await imageService.crop(data, {
        x,
        y,
        width,
        height,
        aspect,
        gravity,
        format: format || 'jpg',
        quality
      })

      // Set appropriate content type
      reply.type('image/jpeg')

      return result.buffer
    } catch (error) {
      if (error.statusCode) throw error
      fastify.log.error(error)
      throw new Error('Failed to process image')
    }
  })
}
