# Docker Deployment for Photo Intelligence Pipeline

This directory contains Docker configurations for running the photo intelligence pipeline in a containerized environment.

## Quick Start

### Build and Run Locally

```bash
# Build the image
docker build -t bottb-photo-intelligence .

# Run the pipeline
docker run --rm \
  -v /Volumes/Extreme\ SSD/Photos:/photos:ro \
  -v $(pwd)/output:/app/output \
  bottb-photo-intelligence \
  python pipeline.py /photos /app/output --batch-size 100 --verbose
```

### Using Docker Compose

```bash
# Edit docker-compose.yml to adjust volume paths
docker-compose up
```

## Image Details

### Base Image

- `python:3.11-slim` - Lightweight Python 3.11 image

### Key Features

- ✅ Pre-installed system dependencies for dlib compilation
- ✅ All Python ML libraries (PyTorch, face_recognition, MediaPipe, etc.)
- ✅ MediaPipe face detection model included
- ✅ Optimized layer caching for faster rebuilds

### Image Size

- Base: ~150MB (python:3.11-slim)
- With dependencies: ~2-3GB (includes PyTorch, models, etc.)

## Deployment Options

### 1. Vercel Serverless Functions

Vercel supports Python functions, but has limitations:

- **Function size limit**: 50MB (uncompressed)
- **Timeout**: 10s (Hobby) / 60s (Pro) / 300s (Enterprise)

**Recommendation**: The pipeline is too large for Vercel serverless functions. Consider:

- Using Vercel's containerized functions (if available)
- Deploying as a separate service (see below)

### 2. AWS Lambda (Container Image)

```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker build -t photo-intelligence .
docker tag photo-intelligence:latest <account>.dkr.ecr.us-east-1.amazonaws.com/photo-intelligence:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/photo-intelligence:latest
```

### 3. Google Cloud Run

```bash
# Build and deploy
gcloud builds submit --tag gcr.io/<project-id>/photo-intelligence
gcloud run deploy photo-intelligence \
  --image gcr.io/<project-id>/photo-intelligence \
  --platform managed \
  --memory 4Gi \
  --timeout 3600
```

### 4. AWS ECS / Fargate

Perfect for long-running batch jobs:

- No timeout limits
- Can scale based on queue depth
- Pay per use

### 5. Azure Container Instances

```bash
# Build and push to ACR
az acr build --registry <registry-name> --image photo-intelligence:latest .
```

## Optimizations

### Multi-stage Build (Future)

For production, consider a multi-stage build to reduce image size:

```dockerfile
# Stage 1: Build dependencies
FROM python:3.11-slim as builder
# ... install build tools and compile ...

# Stage 2: Runtime
FROM python:3.11-slim
# ... copy only compiled artifacts ...
```

### Model Caching

Models are downloaded at runtime. For faster cold starts:

- Pre-download models in Dockerfile
- Use model caching layer
- Consider model quantization

## Environment Variables

The container respects these environment variables:

- `PYTHONUNBUFFERED=1` - Immediate stdout/stderr (recommended)
- `CUDA_VISIBLE_DEVICES` - GPU selection (if using GPU base image)

## Troubleshooting

### dlib Compilation Fails

If dlib fails to compile:

1. Ensure build-essential and cmake are installed
2. Check available memory (dlib needs ~2GB RAM to compile)
3. Consider using pre-built wheel: `pip install dlib-binary`

### Out of Memory

If the container runs out of memory:

- Increase Docker memory limit
- Reduce batch size
- Use CPU-only PyTorch build

### Slow Performance

- Use GPU base image if available: `nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04`
- Enable GPU passthrough: `--gpus all`
- Optimize batch size for your hardware

## Development

### Rebuild After Changes

```bash
# Rebuild without cache
docker build --no-cache -t bottb-photo-intelligence .

# Rebuild with cache (faster)
docker build -t bottb-photo-intelligence .
```

### Interactive Shell

```bash
docker run -it --rm \
  -v /Volumes/Extreme\ SSD/Photos:/photos:ro \
  bottb-photo-intelligence \
  /bin/bash
```
