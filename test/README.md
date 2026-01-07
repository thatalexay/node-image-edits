# Test Suite

This directory contains comprehensive tests for all API endpoints.

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
node --test test/routes/health.test.js

# Run all v1 endpoint tests
node --test test/routes/v1/*.test.js
```

## Test Structure

```
test/
├── helper.js                   # Shared test utilities
├── routes/
│   ├── health.test.js         # GET /health endpoint (2 tests)
│   ├── source.test.js         # GET /source endpoint (2 tests)
│   └── v1/
│       ├── resize.test.js     # POST /v1/resize endpoint (8 tests)
│       ├── crop.test.js       # POST /v1/crop endpoint (9 tests)
│       └── remove-bg.test.js  # POST /v1/remove-bg endpoint (10 tests, 6 skipped)
```

## Test Coverage

### Meta Endpoints (Unauthenticated)
- **GET /health** - Health check endpoint (2 tests)
  - Returns { ok: true }
  - Includes AGPL compliance headers

- **GET /source** - Source code disclosure (2 tests)
  - Returns package metadata
  - Includes AGPL compliance headers

### Image Processing Endpoints (Authenticated)

#### POST /v1/resize (8 tests)
- ✅ Authentication requirement
- ✅ Invalid API key handling
- ✅ Resize to specified dimensions
- ✅ Aspect ratio preservation (width only)
- ✅ Fit modes (cover, contain, etc.)
- ✅ Format conversion (JPEG, PNG, WebP)
- ✅ Invalid dimensions validation
- ✅ Missing file validation

#### POST /v1/crop (9 tests)
- ✅ Authentication requirement
- ✅ Rectangle crop (x, y, width, height)
- ✅ Aspect ratio crop (1:1, 16:9)
- ✅ Gravity options (north, south, east, west, center)
- ✅ Format conversion (JPEG, PNG, WebP)
- ✅ Invalid crop region handling
- ✅ Missing parameters validation

#### POST /v1/remove-bg (10 tests, 6 skipped)
- ✅ Authentication requirement
- ⏭️  Background removal (skipped - requires real photos)
- ⏭️  Mask output mode (skipped)
- ⏭️  Feathering (skipped)
- ⏭️  Threshold (skipped)
- ⏭️  WebP format (skipped)
- ⏭️  JPEG format (skipped)
- ✅ Invalid feather value validation
- ✅ Invalid threshold value validation
- ✅ Missing file validation

## Test Statistics

- **Total tests**: 31
- **Passing**: 25
- **Failing**: 0
- **Skipped**: 6

## Skipped Tests

The background removal tests that perform actual AI processing are skipped because:
1. The AI model requires realistic photo-like images, not synthetic test images
2. Processing time can be slow (5-10 seconds per image on first run)
3. Model files must be downloaded (~50MB)

### Running Skipped Tests

To run the background removal tests with real photos:

1. Add real test photo fixtures to `test/fixtures/`
2. Update the `createTestImage()` helper in `remove-bg.test.js` to use real photos
3. Remove `.skip` from the test definitions
4. Run: `node --test test/routes/v1/remove-bg.test.js`

## Test Framework

- **Test Runner**: Node.js built-in test runner (node:test)
- **Assertions**: Node.js built-in assert module (node:assert)
- **HTTP Testing**: Fastify inject() for route testing
- **Image Processing**: Sharp for image creation and validation
- **Multipart Forms**: form-data for file upload testing

## Writing New Tests

Example test structure:

```javascript
const { test } = require('node:test')
const assert = require('node:assert')
const { build } = require('../helper')

test('GET /my-endpoint returns data', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    method: 'GET',
    url: '/my-endpoint',
    headers: {
      'x-api-key': 'test-api-key-123'
    }
  })

  assert.strictEqual(res.statusCode, 200)
  const payload = JSON.parse(res.payload)
  assert.ok(payload.data)
})
```

## Continuous Integration

All tests must pass before merging to main:

```bash
pnpm test
# Expected: All tests passing (25/25), 6 skipped
```
