# Clothing Classification Setup

The clothing classification endpoint uses a MobileNetV2 ONNX model trained on 36K fashion images with 97.13% validation accuracy.

## How It Works

The service automatically handles ONNX model compatibility:

1. **Tries native onnxruntime-node** first for maximum performance (~30-50ms)
2. **Falls back to Python subprocess** if the model uses a newer ONNX IR version not supported by the Node.js bindings (~100-150ms)

### Why Python Fallback?

The npm package `onnxruntime-node@1.23.2` ships with pre-built binaries using ONNX Runtime core ~1.17, which only supports:
- **ONNX IR version 9** (max opset 12)

Our trained model exports with PyTorch 2.9.1, which uses:
- **ONNX IR version 10** (opset 18)

The Python `onnxruntime` package has newer core binaries that support IR v10, so we use it as a fallback.

## Model Setup

### Prerequisites

1. **Python 3.11+** with virtual environment
2. **ONNX model file** at `./models/mobilenet-fashion-5cat.onnx`
3. **Python dependencies** (if using fallback):
   ```bash
   cd ../image-categorization
   python3 -m venv venv
   source venv/bin/activate
   pip install onnxruntime pillow numpy
   ```

### Configuration

Optional environment variables in `.env`:

```bash
# Model path (default: ./models/mobilenet-fashion-5cat.onnx)
CLASSIFICATION_MODEL_PATH=./models/mobilenet-fashion-5cat.onnx

# Python fallback configuration (auto-detected)
PYTHON_CLASSIFIER_SCRIPT=../image-categorization/classify_image.py
PYTHON_BIN=/path/to/venv/bin/python3  # Defaults to auto-detect
```

The service will:
1. Auto-detect venv Python at `../image-categorization/venv/bin/python3`
2. Fall back to system `python3` if venv not found
3. Use `PYTHON_BIN` environment variable if explicitly set

## Training Your Own Model

See `../image-categorization/README.md` for complete training instructions.

**Quick start:**
```bash
cd ../image-categorization
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Download Kaggle dataset (requires API key)
kaggle datasets download -d paramaggarwal/fashion-product-images-small
unzip fashion-product-images-small.zip -d fashion-dataset

# Organize and train
python organize_dataset.py
python train_m1.py  # 2-3 hours on M1 Max

# Export to ONNX
python export_onnx_v12.py

# Copy to node-image-edits
cp mobilenet-fashion-5cat.onnx ../node-image-edits/models/
```

## Performance

| Mode | Inference Time | Use Case |
|------|---------------|----------|
| Native ONNX Runtime | ~30-50ms | When onnxruntime-node supports model IR version |
| Python Fallback | ~100-150ms | When newer ONNX models need Python onnxruntime |
| First Request | +1-2 seconds | Model loading time (one-time per process) |

The Python fallback adds ~100ms latency but ensures compatibility with the latest ONNX models.

## Deployment Considerations

### For Production

**Option 1: Use Python Fallback** (Current - Recommended ✅)
- Works out of the box
- No build complexity
- Acceptable latency for most use cases
- Requires Python 3 with onnxruntime installed

**Option 2: Build ONNX Runtime from Source**
- Compile onnxruntime-node with latest core for IR v10 support
- Achieves ~30-50ms native performance
- Complex build process (~30-60 min, requires C++ toolchain)
- Must rebuild for each platform

### Docker Deployment

Include Python and dependencies in your Dockerfile:

```dockerfile
FROM node:20-slim

# Install Python and system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Copy classification scripts and setup Python environment
WORKDIR /app
COPY image-categorization/requirements.txt ./image-categorization/
COPY image-categorization/classify_image.py ./image-categorization/
COPY image-categorization/mobilenet-fashion-5cat.onnx ./image-categorization/

RUN cd image-categorization && \
    python3 -m venv venv && \
    ./venv/bin/pip install -r requirements.txt

# Copy and install Node.js app
COPY node-image-edits/package.json node-image-edits/pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

COPY node-image-edits/ ./
CMD ["pnpm", "start"]
```

## Troubleshooting

### Python subprocess fails

**Error:** `Python fallback not available`

**Solution:** Install Python dependencies:
```bash
cd ../image-categorization
python3 -m venv venv
source venv/bin/activate
pip install onnxruntime pillow numpy
```

### Model not found

**Error:** `Classification model not found at "./models/mobilenet-fashion-5cat.onnx"`

**Solution:** Train and copy the model:
```bash
cd ../image-categorization
# Follow training instructions
cp mobilenet-fashion-5cat.onnx ../node-image-edits/models/
```

### Slow first request

First request loads the model into memory (~1-2 seconds). This is normal and only happens once per process restart.

## Categories

The model classifies into 5 categories:

- **tops** - T-shirts, shirts, blouses, sweaters, tanks
- **bottoms** - Pants, jeans, skirts, shorts, leggings
- **shoes** - Sneakers, boots, sandals, heels, slippers
- **outerwear** - Jackets, coats, hoodies, blazers
- **accessories** - Bags, hats, belts, scarves, watches

Training accuracy: **97.13%** on 7,219 validation images.
