'use strict'

const sharp = require('sharp')
const { removeBackground } = require('@imgly/background-removal-node')

/**
 * Image Processing Service
 * Handles resize, crop, and background removal operations using Sharp
 */
class ImageService {
  constructor() {
    // Use default bundled models from @imgly/background-removal-node package
    this.bgRemovalConfig = {
      model: 'medium', // 'small' (~40MB) or 'medium' (~80MB)
      debug: false
    }
  }
  normalizeOutputFormat(format) {
    if (!format) return 'jpeg'
    if (format === 'jpg' || format === 'jpeg') return 'jpeg'
    return format
  }
  /**
   * Resize an image
   * @param {Object} fileData - Multipart file data
   * @param {Object} options - Resize options
   * @returns {Promise<{buffer: Buffer, info: Object}>}
   */
  async resize(fileData, options) {
    const { width, height, fit = 'inside', format, quality, background } = options
    const outputFormat = this.normalizeOutputFormat(format)

    // Convert file stream to buffer
    const inputBuffer = await fileData.toBuffer()

    // Create Sharp instance
    let pipeline = sharp(inputBuffer)

    // Apply resize
    const resizeOptions = {
      width,
      height,
      fit, // cover, contain, fill, inside, outside
      withoutEnlargement: false
    }

    // Add background color if specified (for formats without alpha)
    if (background) {
      resizeOptions.background = background
    }

    pipeline = pipeline.resize(resizeOptions)

    // Apply output format
    if (outputFormat === 'jpeg') {
      pipeline = pipeline.jpeg({ quality: quality || 80 })
    } else if (outputFormat === 'webp') {
      pipeline = pipeline.webp({ quality: quality || 80 })
    } else if (outputFormat === 'png') {
      pipeline = pipeline.png()
    } else {
      pipeline = pipeline.jpeg({ quality: quality || 80 })
    }

    // Process and return
    const buffer = await pipeline.toBuffer()
    const info = await sharp(buffer).metadata()

    return { buffer, info }
  }

  /**
   * Crop an image
   * @param {Object} fileData - Multipart file data
   * @param {Object} options - Crop options
   * @returns {Promise<{buffer: Buffer, info: Object}>}
   */
  async crop(fileData, options) {
    const { x, y, width, height, aspect, gravity = 'center', format, quality } = options
    const outputFormat = this.normalizeOutputFormat(format)

    // Convert file stream to buffer
    const inputBuffer = await fileData.toBuffer()

    // Create Sharp instance
    let pipeline = sharp(inputBuffer)

    // Rectangle crop takes precedence
    if (x !== undefined && y !== undefined && width !== undefined && height !== undefined) {
      pipeline = pipeline.extract({ left: x, top: y, width, height })
    } else if (aspect) {
      // Aspect ratio crop
      const [aspectWidth, aspectHeight] = aspect.split(':').map(Number)
      const targetAspect = aspectWidth / aspectHeight

      // Get image metadata
      const metadata = await sharp(inputBuffer).metadata()
      const imageAspect = metadata.width / metadata.height

      let extractWidth, extractHeight, left, top

      if (imageAspect > targetAspect) {
        // Image is wider than target aspect
        extractHeight = metadata.height
        extractWidth = Math.round(extractHeight * targetAspect)
        top = 0

        // Calculate left based on gravity
        if (gravity === 'west') {
          left = 0
        } else if (gravity === 'east') {
          left = metadata.width - extractWidth
        } else {
          left = Math.round((metadata.width - extractWidth) / 2)
        }
      } else {
        // Image is taller than target aspect
        extractWidth = metadata.width
        extractHeight = Math.round(extractWidth / targetAspect)
        left = 0

        // Calculate top based on gravity
        if (gravity === 'north') {
          top = 0
        } else if (gravity === 'south') {
          top = metadata.height - extractHeight
        } else {
          top = Math.round((metadata.height - extractHeight) / 2)
        }
      }

      pipeline = pipeline.extract({ left, top, width: extractWidth, height: extractHeight })
    }

    // Apply output format
    if (outputFormat === 'jpeg') {
      pipeline = pipeline.jpeg({ quality: quality || 80 })
    } else if (outputFormat === 'webp') {
      pipeline = pipeline.webp({ quality: quality || 80 })
    } else if (outputFormat === 'png') {
      pipeline = pipeline.png()
    } else {
      pipeline = pipeline.jpeg({ quality: quality || 80 })
    }

    // Process and return
    const buffer = await pipeline.toBuffer()
    const info = await sharp(buffer).metadata()

    return { buffer, info }
  }

  /**
   * Remove background from an image
   * @param {Object} fileData - Multipart file data
   * @param {Object} options - Background removal options
   * @returns {Promise<{buffer: Buffer, info: Object}>}
   */
  async removeBackground(fileData, options) {
    const { output = 'image', format, feather, threshold } = options
    const outputFormat = this.normalizeOutputFormat(format)

    // Convert file stream to buffer
    const inputBuffer = await fileData.toBuffer()

    // Create a Blob with proper mime type for the background removal library
    const inputBlob = new Blob([inputBuffer], { type: fileData.mimetype || 'image/png' })

    // Configure background removal output based on requested output type
    const bgConfig = {
      ...this.bgRemovalConfig,
      output: {
        format: 'image/png',
        quality: 0.8,
        type: output === 'mask' ? 'mask' : 'foreground'
      }
    }

    // Run background removal using @imgly/background-removal-node
    const blob = await removeBackground(inputBlob, bgConfig)

    // Convert Blob to Buffer
    const arrayBuffer = await blob.arrayBuffer()
    let resultBuffer = Buffer.from(arrayBuffer)

    // Process with Sharp for additional transformations
    // Note: When output is 'mask', the library already returns a grayscale mask
    let pipeline = sharp(resultBuffer)

    // Apply feathering (blur the alpha channel edges)
    if (feather && feather > 0 && output !== 'mask') {
      // Split into channels, blur alpha, then recombine
      const metadata = await sharp(resultBuffer).metadata()

      if (metadata.channels === 4) {
        // Extract RGB and Alpha channels
        const rgb = await sharp(resultBuffer)
          .removeAlpha()
          .toBuffer()

        const alpha = await sharp(resultBuffer)
          .extractChannel('alpha')
          .blur(feather)
          .toBuffer()

        // Recombine
        resultBuffer = await sharp(rgb)
          .joinChannel(alpha)
          .toBuffer()

        pipeline = sharp(resultBuffer)
      }
    }

    // Apply threshold to alpha channel (for mask output)
    if (threshold !== undefined && output === 'mask') {
      pipeline = pipeline.threshold(threshold)
    }

    // Apply output format
    if (outputFormat === 'jpeg') {
      // JPEG doesn't support transparency, flatten with white background
      pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: 80 })
    } else if (outputFormat === 'webp') {
      pipeline = pipeline.webp({ quality: 80 })
    } else {
      pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: 80 })
    }

    const buffer = await pipeline.toBuffer()
    const info = await sharp(buffer).metadata()

    return { buffer, info }
  }
}

module.exports = new ImageService()
