'use strict'

// This file contains code that we reuse
// between our tests.

const { build: buildApplication } = require('fastify-cli/helper')
const path = require('node:path')
const fs = require('node:fs')
const AppPath = path.join(__dirname, '..', 'app.js')

// Fill in this config with all the configurations
// needed for testing the application
function config () {
  return {
    skipOverride: true // Register our application with fastify-plugin
  }
}

// automatically build and tear down our instance
async function build (t) {
  // you can set all the options supported by the fastify CLI command
  const argv = [AppPath]

  // fastify-plugin ensures that all decorators
  // are exposed for testing purposes, this is
  // different from the production setup
  const app = await buildApplication(argv, config())

  // close the app after we are done
  t.after(() => app.close())

  return app
}

// Get a random test image from test/assets/
function getRandomTestImage () {
  const assetsDir = path.join(__dirname, 'assets')
  const files = fs.readdirSync(assetsDir).filter(f => !f.startsWith('.'))

  if (files.length === 0) {
    throw new Error('No test images found in test/assets/')
  }

  const randomFile = files[Math.floor(Math.random() * files.length)]
  const filePath = path.join(assetsDir, randomFile)

  return {
    path: filePath,
    filename: randomFile,
    buffer: fs.readFileSync(filePath)
  }
}

// Save output for visual inspection
function saveTestOutput (buffer, testName, format = 'png') {
  const outputsDir = path.join(__dirname, 'outputs')

  // Ensure outputs directory exists
  if (!fs.existsSync(outputsDir)) {
    fs.mkdirSync(outputsDir, { recursive: true })
  }

  const timestamp = Date.now()
  const filename = `${testName}-${timestamp}.${format}`
  const outputPath = path.join(outputsDir, filename)

  fs.writeFileSync(outputPath, buffer)

  return outputPath
}

module.exports = {
  config,
  build,
  getRandomTestImage,
  saveTestOutput
}
