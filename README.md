# node-image-editing
This package (resize, crop, remove background) designed for always-on Node.js deployment. This service is intended to be open sourced under AGPL-3.0-or-later.

## Features

- **Resize**: Resize images with various fit modes (cover, contain, fill, inside, outside)
- **Crop**: Crop images using rectangle coordinates or aspect ratios with gravity
- **Remove Background**: AI-powered background removal using `@imgly/background-removal-node`
  - Returns cutout with transparency or grayscale mask
  - Edge feathering and threshold controls
  - Local model hosting for faster performance
- **Color Extraction**: Extract prominent colors from images as human-readable color names
  - Returns up to 3 most prominent colors with standardized names (red, blue, green, etc.)
  - Automatic multicolor detection for products with multiple equally prominent colors
  - Perfect for product tagging and categorization
- **API Key Authentication**: Secure endpoints with X-Api-Key header
- **Rate Limiting**: Built-in rate limiting to prevent abuse
- **AGPL Compliance**: Source code disclosure via `/source` endpoint and `X-Source-Code` header

## Quick Start

### Installation

```bash
pnpm install
```

**Note:** The `download-models` script runs during install to fetch AI models (~50MB). Set `SKIP_MODEL_DOWNLOAD=1` to skip this (recommended on Render), since the package already ships its assets locally in `node_modules`.

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

**Required environment variables:**
- `API_KEYS` - Comma-separated list of valid API keys

**Optional environment variables:**
- `BG_REMOVAL_MODEL_PATH` - Path to local AI models (default: `./models`)
- `PORT` - Server port (default: `3000`)
- `MAX_FILE_SIZE` - Max upload size in bytes (default: `10485760` / 10MB)
- `SKIP_MODEL_DOWNLOAD` - Set to `1` to skip postinstall model download

### Development

```bash
pnpm dev
```

Server runs on [http://localhost:3001](http://localhost:3001) (configured in `.env`)

### Production

```bash
pnpm start
```

### Download Models Manually (Optional)

Only needed if you want to self-host the background removal assets instead of using the packaged files in `node_modules/@imgly/background-removal-node/dist`. If install download was skipped, you can also run this manually.

```bash
pnpm run download-models
```

## API Endpoints

### Meta Endpoints (Unauthenticated)

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "ok": true
}
```

#### GET /source
Source code disclosure (AGPL compliance).

**Response:**
```json
{
  "name": "node-image-editing",
  "version": "0.1.0",
  "commit": "abc1234",
  "source": "https://github.com/thatalexay/node-image-editing",
  "license": "AGPL-3.0-or-later"
}
```

### Image Operations (Authenticated)

All image endpoints require `X-Api-Key` header.

#### POST /v1/resize
Resize an image.

**Request:** `multipart/form-data`
- `file` (required): Image file (`jpg`, `png`, `webp`, `heic`)
- `width` (optional): Target width in pixels
- `height` (optional): Target height in pixels
- `fit` (optional): Fit mode - `cover`, `contain`, `fill`, `inside`, `outside` (default: `inside`)
- `format` (optional): Output format - `jpg`
- `quality` (optional): JPEG quality (1-100)
- `background` (optional): Background color hex (e.g., `#ffffff`)

**Response:** Resized image (binary)

**Example:**
```bash
curl -X POST http://localhost:3001/v1/resize \
  -H "X-Api-Key: test-api-key-123" \
  -F "file=@input.jpg" \
  -F "width=800" \
  -F "height=600" \
  -F "fit=cover" \
  --output resized.jpg
```

#### POST /v1/crop
Crop an image.

**Request:** `multipart/form-data`
- `file` (required): Image file (`jpg`, `png`, `webp`, `heic`)
- Rectangle crop (all required if using):
  - `x`: Left position
  - `y`: Top position
  - `width`: Crop width
  - `height`: Crop height
- Aspect crop (alternative to rectangle):
  - `aspect`: Aspect ratio (e.g., `16:9`, `1:1`, `4:5`)
  - `gravity`: Crop gravity - `center`, `north`, `south`, `east`, `west` (default: `center`)
- `format` (optional): Output format - `jpg`
- `quality` (optional): JPEG quality (1-100)

**Response:** Cropped image (binary)

**Example (rectangle):**
```bash
curl -X POST http://localhost:3001/v1/crop \
  -H "X-Api-Key: test-api-key-123" \
  -F "file=@input.jpg" \
  -F "x=100" \
  -F "y=100" \
  -F "width=500" \
  -F "height=500" \
  --output cropped.jpg
```

**Example (aspect ratio):**
```bash
curl -X POST http://localhost:3001/v1/crop \
  -H "X-Api-Key: test-api-key-123" \
  -F "file=@input.jpg" \
  -F "aspect=1:1" \
  -F "gravity=center" \
  --output cropped.jpg
```

#### POST /v1/remove-bg
Remove image background using AI.

**Request:** `multipart/form-data`
- `file` (required): Image file (`jpg`, `png`, `webp`, `heic`)
- `output` (optional): Output type - `image` (cutout on filled background), `mask` (grayscale mask) (default: `image`)
- `format` (optional): Output format - `jpg` (default: `jpg`)
- `feather` (optional): Edge feathering amount (0-10) for smoother edges
- `threshold` (optional): Mask threshold cutoff (0-255) for binary mask

**Response:** Background-removed image or mask (binary)

**Examples:**
```bash
# Basic background removal
curl -X POST http://localhost:3001/v1/remove-bg \
  -H "X-Api-Key: test-api-key-123" \
  -F "file=@input.jpg" \
  --output output.jpg

# With feathering for smooth edges
curl -X POST http://localhost:3001/v1/remove-bg \
  -H "X-Api-Key: test-api-key-123" \
  -F "file=@input.jpg" \
  -F "feather=3" \
  --output output-smooth.jpg

# Get mask only
curl -X POST http://localhost:3001/v1/remove-bg \
  -H "X-Api-Key: test-api-key-123" \
  -F "file=@input.jpg" \
  -F "output=mask" \
  --output mask.jpg
```

**Note:** First request may take 5-10 seconds as AI models load into memory. Subsequent requests are faster (2-5 seconds).

#### POST /v1/extract-colors
Extract prominent colors from an image and convert them to standardized color names.

**Request:** `multipart/form-data`
- `file` (required): Image file (`jpg`, `png`, `webp`, `heic`)
- `maxColors` (optional): Maximum number of colors to extract (1-10, default: `3`)
- `multicolorThreshold` (optional): Threshold for multicolor detection (0-1, default: `0.20`)
  - If colors are more evenly distributed than this threshold, adds "multicolor" tag

**Response:** JSON
```json
{
  "colors": ["red", "blue", "multicolor"],
  "palette": {
    "swatches": [
      {
        "hex": "#fc0404",
        "rgb": [252, 4, 4],
        "colorName": "red",
        "population": 12500,
        "percentage": 45
      },
      {
        "hex": "#0404fc",
        "rgb": [4, 4, 252],
        "colorName": "blue",
        "population": 10000,
        "percentage": 36
      }
    ],
    "totalPopulation": 27777,
    "isMulticolor": true
  }
}
```

**Examples:**
```bash
# Basic color extraction
curl -X POST http://localhost:3001/v1/extract-colors \
  -H "X-Api-Key: test-api-key-123" \
  -F "file=@product.jpg"

# Extract only top 2 colors
curl -X POST http://localhost:3001/v1/extract-colors \
  -H "X-Api-Key: test-api-key-123" \
  -F "file=@product.jpg" \
  -F "maxColors=2"

# Adjust multicolor threshold
curl -X POST http://localhost:3001/v1/extract-colors \
  -H "X-Api-Key: test-api-key-123" \
  -F "file=@product.jpg" \
  -F "multicolorThreshold=0.30"
```

**Color Names:** The service uses a standardized set of 21 basic color names:
- `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`
- `black`, `white`, `gray`, `brown`, `tan`, `beige`
- `cyan`, `magenta`, `violet`, `lime`, `olive`, `navy`, `teal`, `maroon`

**Use Case:** Perfect for product categorization, search filters, and automatic tagging systems.

## Response Headers

All responses include:
- `X-Source-Code`: URL to source code repository (AGPL compliance)
- `X-Request-Id`: Correlation ID (echoed from request or generated)

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

**Error Codes:**
- `INVALID_INPUT` (400): Invalid request parameters
- `UNAUTHORIZED` (401): Missing or invalid API key
- `PAYLOAD_TOO_LARGE` (413): File too large
- `UNSUPPORTED_MEDIA_TYPE` (415): Invalid file type
- `RATE_LIMITED` (429): Too many requests
- `INTERNAL` (500): Internal server error

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `API_KEYS` | Comma-separated API keys | (required) |
| `SOURCE_CODE_URL` | Source repository URL | `https://github.com/your-org/node-image-editing` |
| `BG_REMOVAL_MODEL_PATH` | Path to local AI models | `./models` |
| `MAX_FILE_SIZE` | Max upload size in bytes | `10485760` (10MB) |
| `RATE_LIMIT_MAX` | Max requests per time window | `100` |
| `RATE_LIMIT_TIMEWINDOW` | Rate limit time window | `1 minute` |
| `PORT` | Server port | `3000` |
| `LOG_LEVEL` | Logging level | `info` |
| `SKIP_MODEL_DOWNLOAD` | Skip postinstall model download | (unset) |

## Development

### Project Structure

```
node-image-edits/
├── app.js                   # Main application file
├── package.json             # Dependencies
├── .env.example             # Environment template
├── api-spec.yaml            # OpenAPI specification
├── models/                  # AI models (optional, downloaded via script)
│   ├── isnet.onnx          # Background removal model
│   ├── isnet_fp16.onnx     # Half-precision variant
│   └── isnet_quant.onnx    # Quantized variant
├── plugins/                 # Fastify plugins
│   ├── auth.js             # API key authentication
│   ├── error-handler.js    # Error handling
│   ├── headers.js          # Response headers (AGPL)
│   ├── sensible.js         # Sensible defaults
│   └── support.js          # Core plugins (CORS, multipart, etc.)
├── routes/                  # API routes
│   ├── health.js           # Health check endpoint
│   ├── source.js           # Source disclosure (AGPL)
│   └── v1/                 # v1 image operations
│       ├── crop.js         # Crop endpoint
│       ├── extract-colors.js # Color extraction endpoint
│       ├── remove-bg.js    # Background removal (AI)
│       └── resize.js       # Resize endpoint
├── scripts/                 # Utility scripts
│   └── download-models.js  # Model downloader
├── services/                # Business logic
│   └── image-service.js    # Image processing (Sharp + AI)
└── test/                    # Tests
```

### Testing

```bash
pnpm test
```

## Deployment

This service is designed for always-on deployment platforms like:
- **Render** Web Service
- **Railway**
- **Fly.io**
- **Google Cloud Run**
- **AWS ECS**

### Deployment Steps

1. **Set environment variables** in your deployment platform:
   - `API_KEYS` (required)
   - `PORT` (optional, defaults to 3000)
   - `MAX_FILE_SIZE` (optional)
   - Other variables as needed

2. **Deploy the repository**
   - On Render, set `SKIP_MODEL_DOWNLOAD=1` to avoid TLS download failures during build
   - If you allow downloads, first deploy may take 2-3 minutes due to model download

3. **Health check**
   - Use `/health` endpoint for readiness checks
   - First background removal request will load models into memory (~5-10 seconds)

### Build Command (if needed)
```bash
pnpm install
```

The `postinstall` hook runs `pnpm run download-models` to fetch AI models unless `SKIP_MODEL_DOWNLOAD=1` is set.

## License

AGPL-3.0-or-later

This service makes its source code discoverable via the `/source` endpoint and `X-Source-Code` response header to comply with AGPL requirements.

## Technologies

- **[Fastify](https://fastify.dev/)** - Fast and low overhead web framework
- **[Sharp](https://sharp.pixelplumbing.com/)** - High-performance image processing
- **[@imgly/background-removal-node](https://www.npmjs.com/package/@imgly/background-removal-node)** - AI-powered background removal
- **[node-vibrant](https://www.npmjs.com/package/node-vibrant)** - Prominent color extraction from images
- **[color-namer](https://www.npmjs.com/package/color-namer)** - Convert hex colors to human-readable color names
- **OpenAPI 3.1** - API specification ([api-spec.yaml](./api-spec.yaml))

## Learn More

- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [IMG.LY Background Removal](https://img.ly/blog/announcing-imgly-background-removal/)
- [OpenAPI Specification](./api-spec.yaml)
