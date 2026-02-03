# node-image-edits API Specification

This document describes the HTTP API for the `node-image-edits` service. All routes are served from the server root (no base path).

## Conventions

### Authentication
- Required for all `/v1/*` routes.
- Header: `X-Api-Key: <key>`
- Error: `401 UNAUTHORIZED` with the standard error body.

### Content Types
- Image operations accept `multipart/form-data` with a single `file` upload.
- Image responses are `image/jpeg` binary (unless otherwise noted).

### Response Headers
- `X-Source-Code`: Source repository URL (AGPL compliance).
- `X-Request-Id`: Correlation ID (echoed from request or generated).

### Limits
- Max upload size: `MAX_FILE_SIZE` (default `10MB`).
- Rate limiting: `RATE_LIMIT_MAX` per `RATE_LIMIT_TIMEWINDOW` (default `100` per `1 minute`).

### Error Format
All errors use a consistent JSON shape:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

Common error codes:
- `INVALID_INPUT` (400)
- `UNAUTHORIZED` (401)
- `PAYLOAD_TOO_LARGE` (413)
- `UNSUPPORTED_MEDIA_TYPE` (415)
- `RATE_LIMITED` (429)
- `INTERNAL` (500)

## Routes

### GET /
**Description:** Simple HTML landing page for the service.

**Input:** None.

**Output:** `text/html` document.

**Errors:** `500` (unexpected server error).

---

### GET /health
**Description:** Health check endpoint.

**Input:** None.

**Output:** JSON
```json
{ "ok": true }
```

**Errors:** `500` (unexpected server error).

---

### GET /source
**Description:** Source code disclosure for AGPL compliance.

**Input:** None.

**Output:** JSON
```json
{
  "name": "node-image-editing",
  "version": "0.1.0",
  "commit": "abc1234",
  "source": "https://github.com/your-org/node-image-editing",
  "license": "AGPL-3.0-or-later"
}
```
Notes:
- `commit` is populated from `GIT_COMMIT_SHA` when available.
- `source` defaults to `SOURCE_CODE_URL` or the built-in fallback.

**Errors:** `500` (unexpected server error).

---

### POST /v1/resize
**Description:** Resize an image with various fit options.

**Authentication:** Required (`X-Api-Key`).

**Input:** `multipart/form-data`
- `file` (required, image): `jpg`, `png`, `webp`, `heic`, `heif`
- `width` (optional, integer >= 1): Target width in pixels
- `height` (optional, integer >= 1): Target height in pixels
- `fit` (optional, string): `cover`, `contain`, `fill`, `inside`, `outside` (default `inside`)
- `format` (optional, string): `jpg` (default `jpg`)
- `quality` (optional, integer 1-100): JPEG quality
- `background` (optional, string): Hex color (e.g., `#ffffff`)

**Output:** `image/jpeg` binary (resized image).

**Errors:**
- `400 INVALID_INPUT` (missing size, invalid fit/format/quality/background)
- `401 UNAUTHORIZED` (missing/invalid API key)
- `413 PAYLOAD_TOO_LARGE` (file exceeds size limit)
- `415 UNSUPPORTED_MEDIA_TYPE` (non-image file)
- `429 RATE_LIMITED`
- `500 INTERNAL`

---

### POST /v1/crop
**Description:** Crop an image using a rectangle or an aspect ratio.

**Authentication:** Required (`X-Api-Key`).

**Input:** `multipart/form-data`
- `file` (required, image): `jpg`, `png`, `webp`, `heic`, `heif`
- Rectangle crop (all required if using rectangle):
  - `x` (integer >= 0)
  - `y` (integer >= 0)
  - `width` (integer >= 1)
  - `height` (integer >= 1)
- Aspect crop (alternative to rectangle):
  - `aspect` (string): `width:height` (e.g., `16:9`, `1:1`)
  - `gravity` (optional, string): `center`, `north`, `south`, `east`, `west` (default `center`)
- `format` (optional, string): `jpg` (default `jpg`)
- `quality` (optional, integer 1-100): JPEG quality

**Output:** `image/jpeg` binary (cropped image).

**Errors:**
- `400 INVALID_INPUT` (missing crop params, invalid aspect/gravity/format/quality)
- `401 UNAUTHORIZED` (missing/invalid API key)
- `413 PAYLOAD_TOO_LARGE` (file exceeds size limit)
- `415 UNSUPPORTED_MEDIA_TYPE` (non-image file)
- `429 RATE_LIMITED`
- `500 INTERNAL`

---

### POST /v1/remove-bg
**Description:** Remove image background and return a cutout or mask.

**Authentication:** Required (`X-Api-Key`).

**Input:** `multipart/form-data`
- `file` (required, image): `jpg`, `png`, `webp`, `heic`, `heif`
- `output` (optional, string): `image` or `mask` (default `image`)
- `format` (optional, string): `jpg` (default `jpg`)
- `feather` (optional, number 0-10): Edge feathering amount
- `threshold` (optional, integer 0-255): Mask threshold

**Output:** `image/jpeg` binary (background-removed image or mask).

**Errors:**
- `400 INVALID_INPUT` (invalid output/format/feather/threshold)
- `401 UNAUTHORIZED` (missing/invalid API key)
- `413 PAYLOAD_TOO_LARGE` (file exceeds size limit)
- `415 UNSUPPORTED_MEDIA_TYPE` (non-image file)
- `429 RATE_LIMITED`
- `500 INTERNAL`

---

### POST /v1/extract-colors
**Description:** Extract prominent colors and return human-readable color names.

**Authentication:** Required (`X-Api-Key`).

**Input:** `multipart/form-data`
- `file` (required, image): `jpg`, `png`, `webp`, `heic`, `heif`
- `maxColors` (optional, integer 1-10, default `3`)
- `multicolorThreshold` (optional, number 0-1, default `0.20`)

**Output:** JSON
```json
{
  "colors": ["red", "blue", "multicolor"],
  "palette": {
    "swatches": [
      {
        "hex": "#aabbcc",
        "rgb": [170, 187, 204],
        "colorName": "blue",
        "population": 1234,
        "percentage": 0.42
      }
    ],
    "totalPopulation": 4567,
    "isMulticolor": false
  }
}
```

**Errors:**
- `400 INVALID_INPUT` (invalid `maxColors`/`multicolorThreshold`)
- `401 UNAUTHORIZED` (missing/invalid API key)
- `413 PAYLOAD_TOO_LARGE` (file exceeds size limit)
- `415 UNSUPPORTED_MEDIA_TYPE` (non-image file)
- `429 RATE_LIMITED`
- `500 INTERNAL`

---

### POST /v1/classify-clothing
**Description:** Classify a clothing item into a category using AI.

**Authentication:** Required (`X-Api-Key`).

**Input:** `multipart/form-data`
- `file` (required, image): `jpg`, `png`, `webp`, `heic`, `heif`

**Output:** JSON
```json
{
  "category": "tops"
}
```
Allowed categories: `tops`, `bottoms`, `shoes`, `outerwear`, `accessories`.

**Errors:**
- `400 INVALID_INPUT` (missing file)
- `401 UNAUTHORIZED` (missing/invalid API key)
- `413 PAYLOAD_TOO_LARGE` (file exceeds size limit)
- `415 UNSUPPORTED_MEDIA_TYPE` (non-image file)
- `429 RATE_LIMITED`
- `500 INTERNAL`
