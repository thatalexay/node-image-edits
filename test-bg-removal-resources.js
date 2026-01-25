#!/usr/bin/env node
'use strict'

const fs = require('fs')
const { removeBackground } = require('@imgly/background-removal-node')

// Helper to format bytes
function formatBytes(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

// Helper to get memory usage
function getMemoryUsage() {
  const usage = process.memoryUsage()
  return {
    rss: formatBytes(usage.rss),
    heapTotal: formatBytes(usage.heapTotal),
    heapUsed: formatBytes(usage.heapUsed),
    external: formatBytes(usage.external),
  }
}

async function testBackgroundRemoval(imagePath, modelSize) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Testing with ${modelSize.toUpperCase()} model`)
  console.log(`Image: ${imagePath}`)
  console.log('='.repeat(60))

  // Initial memory
  const memBefore = getMemoryUsage()
  console.log('\n📊 Memory BEFORE loading model:')
  console.log(`  RSS:        ${memBefore.rss}`)
  console.log(`  Heap Total: ${memBefore.heapTotal}`)
  console.log(`  Heap Used:  ${memBefore.heapUsed}`)
  console.log(`  External:   ${memBefore.external}`)

  // Read image
  const imageBuffer = fs.readFileSync(imagePath)
  const imageBlob = new Blob([imageBuffer], { type: 'image/jpeg' })

  console.log(`\n📁 Image size: ${formatBytes(imageBuffer.length)}`)

  // Start timer
  const startTime = Date.now()
  console.log('\n⏳ Starting background removal...')

  try {
    // Configure for specific model size
    const config = {
      model: modelSize, // 'small' or 'medium'
      debug: false,
      output: {
        format: 'image/png',
        quality: 0.8,
        type: 'foreground'
      }
    }

    // Run background removal
    const resultBlob = await removeBackground(imageBlob, config)
    const processingTime = Date.now() - startTime

    // Memory after processing
    const memAfter = getMemoryUsage()

    console.log('\n✅ Background removal complete!')
    console.log(`⏱️  Processing time: ${processingTime}ms (${(processingTime / 1000).toFixed(2)}s)`)

    console.log('\n📊 Memory AFTER processing:')
    console.log(`  RSS:        ${memAfter.rss}`)
    console.log(`  Heap Total: ${memAfter.heapTotal}`)
    console.log(`  Heap Used:  ${memAfter.heapUsed}`)
    console.log(`  External:   ${memAfter.external}`)

    // Calculate memory increase
    const rssIncrease = process.memoryUsage().rss - parseFloat(memBefore.rss.split(' ')[0]) * 1024 * 1024
    console.log(`\n📈 Memory increase: ${formatBytes(rssIncrease)}`)

    // Result size
    const resultBuffer = Buffer.from(await resultBlob.arrayBuffer())
    console.log(`\n📁 Result size: ${formatBytes(resultBuffer.length)}`)

    return {
      success: true,
      processingTime,
      memoryIncrease: rssIncrease,
      resultSize: resultBuffer.length
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

async function main() {
  const testImage = process.argv[2] || './test/assets/202411132226293ea.jpg'
  const modelSize = process.argv[3] || 'medium'

  if (!fs.existsSync(testImage)) {
    console.error(`Error: Image file not found: ${testImage}`)
    console.error('Usage: node test-bg-removal-resources.js <image-path> [model-size]')
    console.error('Example: node test-bg-removal-resources.js ./test/assets/202411132226293ea.jpg medium')
    process.exit(1)
  }

  console.log('\n🚀 Background Removal Resource Test')
  console.log(`Node version: ${process.version}`)
  console.log(`Platform: ${process.platform}`)
  console.log(`Architecture: ${process.arch}`)

  // Test with specified model
  await testBackgroundRemoval(testImage, modelSize)

  console.log('\n' + '='.repeat(60))
  console.log('Test complete!')
  console.log('='.repeat(60) + '\n')
}

main().catch(console.error)
