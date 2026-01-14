'use strict'

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const ort = require('onnxruntime-node')
const { execFile } = require('child_process')
const { promisify } = require('util')
const os = require('os')

const execFileAsync = promisify(execFile)

/**
 * Clothing Classification Service
 * Handles AI-powered classification of clothing items into 5 categories
 * using ONNX Runtime (Node.js) or Python subprocess (fallback)
 */
class ClothingClassificationService {
  constructor() {
    this.session = null
    this.usePythonFallback = false
    this.modelPath = process.env.CLASSIFICATION_MODEL_PATH || path.join(__dirname, '..', 'models', 'mobilenet-fashion-5cat.onnx')
    this.pythonScript = process.env.PYTHON_CLASSIFIER_SCRIPT || path.join(__dirname, '..', '..', 'image-categorization', 'classify_image.py')
    // Default to venv python if available, otherwise system python3
    const venvPython = path.join(__dirname, '..', '..', 'image-categorization', 'venv', 'bin', 'python3')
    this.pythonBin = process.env.PYTHON_BIN || (fs.existsSync(venvPython) ? venvPython : 'python3')
    this.categories = {
      0: 'tops',
      1: 'bottoms',
      2: 'shoes',
      3: 'outerwear',
      4: 'accessories'
    }
  }

  /**
   * Load ONNX model (lazy loading on first request)
   * Falls back to Python subprocess if onnxruntime-node doesn't support model IR version
   * @returns {Promise<void>}
   */
  async loadModel() {
    if (this.session || this.usePythonFallback) {
      return // Model already loaded or using Python fallback
    }

    // Check if model file exists
    if (!fs.existsSync(this.modelPath)) {
      throw new Error(
        `Classification model not found at "${this.modelPath}". ` +
        `Please add the ONNX model file or configure CLASSIFICATION_MODEL_PATH environment variable. ` +
        `See README.md for model training/download instructions.`
      )
    }

    try {
      // Try to create ONNX Runtime inference session
      this.session = await ort.InferenceSession.create(this.modelPath)
      console.log(`✅ Loaded classification model from ${this.modelPath} (onnxruntime-node)`)
    } catch (error) {
      // Check if it's an IR version incompatibility
      if (error.message.includes('Unsupported model IR version') || error.message.includes('IR version')) {
        console.warn(`⚠️  onnxruntime-node doesn't support this model's IR version`)
        console.warn(`   Falling back to Python subprocess for classification`)

        // Check if Python script exists
        if (!fs.existsSync(this.pythonScript)) {
          throw new Error(
            `Python fallback script not found at "${this.pythonScript}". ` +
            `Please ensure classify_image.py is available.`
          )
        }

        // Test Python classifier
        try {
          const { stdout } = await execFileAsync(this.pythonBin, ['--version'])
          console.log(`   Using Python: ${stdout.trim()}`)
          this.usePythonFallback = true
        } catch (pythonError) {
          throw new Error(
            `Python fallback not available: ${pythonError.message}. ` +
            `Install Python 3 with onnxruntime, PIL, and numpy.`
          )
        }
      } else {
        throw new Error(`Failed to load classification model: ${error.message}`)
      }
    }
  }

  /**
   * Preprocess image for MobileNetV2 inference
   * Converts image to 224x224 RGB tensor in NCHW format [1, 3, 224, 224]
   * @param {Buffer} imageBuffer - Input image buffer
   * @returns {Promise<Float32Array>} Preprocessed tensor data
   */
  async preprocessImage(imageBuffer) {
    // Resize to 224x224 and convert to RGB
    const processedImage = await sharp(imageBuffer)
      .resize(224, 224, { fit: 'cover' })
      .removeAlpha() // Ensure RGB (3 channels)
      .raw()
      .toBuffer({ resolveWithObject: true })

    const { data, info } = processedImage

    // Verify dimensions
    if (info.width !== 224 || info.height !== 224 || info.channels !== 3) {
      throw new Error(`Invalid preprocessed image dimensions: ${info.width}x${info.height}x${info.channels}`)
    }

    // Convert to Float32Array and normalize to [0, 1]
    // Reshape from HWC (height, width, channels) to NCHW (batch, channels, height, width)
    const tensorData = new Float32Array(1 * 3 * 224 * 224)

    for (let c = 0; c < 3; c++) {
      for (let h = 0; h < 224; h++) {
        for (let w = 0; w < 224; w++) {
          const pixelIndex = (h * 224 + w) * 3 + c
          const tensorIndex = c * 224 * 224 + h * 224 + w
          tensorData[tensorIndex] = data[pixelIndex] / 255.0
        }
      }
    }

    return tensorData
  }

  /**
   * Apply softmax to convert logits to probabilities
   * @param {Float32Array} logits - Raw model output
   * @returns {Float32Array} Probabilities
   */
  softmax(logits) {
    const maxLogit = Math.max(...logits)
    const expValues = Array.from(logits).map(x => Math.exp(x - maxLogit))
    const sumExp = expValues.reduce((a, b) => a + b, 0)
    return new Float32Array(expValues.map(x => x / sumExp))
  }

  /**
   * Classify using Python subprocess
   * @param {Buffer} imageBuffer - Image data
   * @returns {Promise<{category: string}>} Classification result
   */
  async classifyWithPython(imageBuffer) {
    // Write image to temporary file
    const tmpFile = path.join(os.tmpdir(), `classify-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`)

    try {
      await fs.promises.writeFile(tmpFile, imageBuffer)

      // Run Python script
      const { stdout, stderr } = await execFileAsync(this.pythonBin, [
        this.pythonScript,
        tmpFile
      ], {
        timeout: 30000 // 30 second timeout
      })

      if (stderr && stderr.includes('error')) {
        throw new Error(`Python classification error: ${stderr}`)
      }

      // Parse JSON result
      const result = JSON.parse(stdout.trim())

      if (!result.category) {
        throw new Error('Invalid Python classification response')
      }

      return result
    } finally {
      // Clean up temporary file
      try {
        await fs.promises.unlink(tmpFile)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Classify a clothing item image
   * @param {Object} fileData - Multipart file data from Fastify
   * @returns {Promise<{category: string}>} Classification result
   */
  async classify(fileData) {
    // Load model on first request (lazy loading)
    await this.loadModel()

    // Convert file stream to buffer
    const inputBuffer = await fileData.toBuffer()

    // Use Python fallback if onnxruntime-node not compatible
    if (this.usePythonFallback) {
      return await this.classifyWithPython(inputBuffer)
    }

    // Preprocess image to tensor
    const tensorData = await this.preprocessImage(inputBuffer)

    // Create ONNX tensor
    const inputTensor = new ort.Tensor('float32', tensorData, [1, 3, 224, 224])

    // Run inference
    const feeds = { [this.session.inputNames[0]]: inputTensor }
    const results = await this.session.run(feeds)

    // Get output tensor
    const outputTensor = results[this.session.outputNames[0]]
    const logits = outputTensor.data

    // Apply softmax and get argmax (category with highest probability)
    const probabilities = this.softmax(logits)
    const categoryIndex = probabilities.indexOf(Math.max(...probabilities))

    // Map index to category name
    const category = this.categories[categoryIndex]

    if (!category) {
      throw new Error(`Invalid category index: ${categoryIndex}`)
    }

    return { category }
  }
}

module.exports = new ClothingClassificationService()
