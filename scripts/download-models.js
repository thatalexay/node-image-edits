#!/usr/bin/env node
'use strict'

/**
 * Download background removal models for local hosting
 * This improves cold start performance and enables offline usage
 */

if (process.env.SKIP_MODEL_DOWNLOAD === '1') {
  console.log('↪ Skipping model download (SKIP_MODEL_DOWNLOAD=1)')
  process.exit(0)
}

const fs = require('fs')
const path = require('path')
const https = require('https')

const MODELS_DIR = path.join(__dirname, '..', 'models')
const MODEL_BASE_URL = 'https://static.imgtoolkit.com/models'

// Model files required for @imgly/background-removal-node
const MODEL_FILES = [
  'isnet.onnx',
  'isnet_fp16.onnx',
  'isnet_quant.onnx'
]

// Ensure models directory exists
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true })
}

/**
 * Download a file from URL to local path
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath)

    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        return downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject)
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`))
        return
      }

      const totalSize = parseInt(response.headers['content-length'], 10)
      let downloadedSize = 0

      response.on('data', (chunk) => {
        downloadedSize += chunk.length
        const progress = ((downloadedSize / totalSize) * 100).toFixed(1)
        process.stdout.write(`\r  Downloading: ${progress}%`)
      })

      response.pipe(file)

      file.on('finish', () => {
        file.close()
        console.log() // New line after progress
        resolve()
      })
    }).on('error', (err) => {
      fs.unlink(destPath, () => {}) // Clean up failed download
      reject(err)
    })

    file.on('error', (err) => {
      fs.unlink(destPath, () => {}) // Clean up on file error
      reject(err)
    })
  })
}

/**
 * Main download process
 */
async function downloadModels() {
  console.log('📦 Downloading background removal models...\n')

  for (const modelFile of MODEL_FILES) {
    const destPath = path.join(MODELS_DIR, modelFile)

    // Skip if already exists
    if (fs.existsSync(destPath)) {
      const stats = fs.statSync(destPath)
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2)
      console.log(`✓ ${modelFile} already exists (${sizeMB} MB)`)
      continue
    }

    const url = `${MODEL_BASE_URL}/${modelFile}`
    console.log(`Downloading ${modelFile}...`)

    try {
      await downloadFile(url, destPath)
      const stats = fs.statSync(destPath)
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2)
      console.log(`✓ ${modelFile} downloaded (${sizeMB} MB)`)
    } catch (error) {
      console.error(`✗ Failed to download ${modelFile}:`, error.message)
      process.exit(1)
    }
  }

  console.log('\n✅ All models downloaded successfully!')
  console.log(`📁 Models stored in: ${MODELS_DIR}`)
}

// Run download
downloadModels().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
