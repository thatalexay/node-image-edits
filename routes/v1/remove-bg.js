'use strict'

const imageService = require('../../services/image-service')

/**
 * Remove Background Route
 * POST /v1/remove-bg - Remove image background and return cutout or mask
 */
module.exports = async function (fastify, opts) {
  fastify.post('/remove-bg', {
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
      const output = data.fields.output?.value || 'image'
      const format = data.fields.format?.value
      const feather = data.fields.feather?.value ? parseFloat(data.fields.feather.value) : undefined
      const threshold = data.fields.threshold?.value ? parseInt(data.fields.threshold.value) : undefined

      // Validate output type
      const validOutputs = ['image', 'mask']
      if (!validOutputs.includes(output)) {
        throw fastify.httpErrors.createError(400, `Invalid output. Must be one of: ${validOutputs.join(', ')}`)
      }

      // Validate format
      const validFormats = ['png', 'jpeg', 'webp']
      if (format && !validFormats.includes(format)) {
        throw fastify.httpErrors.createError(400, `Invalid format. Must be one of: ${validFormats.join(', ')}`)
      }

      // Validate feather
      if (feather !== undefined && (feather < 0 || feather > 10)) {
        throw fastify.httpErrors.createError(400, 'Feather must be between 0 and 10')
      }

      // Validate threshold
      if (threshold !== undefined && (threshold < 0 || threshold > 255)) {
        throw fastify.httpErrors.createError(400, 'Threshold must be between 0 and 255')
      }

      // Validate file type
      const mimeType = data.mimetype
      if (!mimeType || !mimeType.startsWith('image/')) {
        throw fastify.httpErrors.createError(415, 'File must be an image')
      }

      // Process the image
      const result = await imageService.removeBackground(data, {
        output,
        format,
        feather,
        threshold
      })

      // Set appropriate content type
      // Default to PNG for transparency support
      const outputFormat = format || 'png'
      reply.type(`image/${outputFormat}`)

      return result.buffer
    } catch (error) {
      if (error.statusCode) throw error
      fastify.log.error(error)
      throw new Error('Failed to process image')
    }
  })
}
