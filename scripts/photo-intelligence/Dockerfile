# Multi-stage Dockerfile - Optimized for smaller final image
# Stage 1: Build dependencies (can be discarded)
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install --no-cache-dir uv

# Copy requirements and install Python packages
COPY requirements.txt /app/requirements.txt
RUN uv pip install --system --no-cache -r requirements.txt

# Stage 2: Runtime image (smaller, no build tools)
FROM python:3.11-slim

WORKDIR /app

# Install only runtime dependencies (no build tools)
# Use generic package names that work across Debian versions
RUN apt-get update && apt-get install -y \
    libopenblas0 \
    liblapack3 \
    libgomp1 \
    libx11-6 \
    libgtk-3-0 \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-0 \
    libxvidcore4 \
    libx264-dev \
    libjpeg62-turbo \
    libpng16-16 \
    libtiff6 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy model and code
COPY models/blaze_face_short_range.tflite /app/models/blaze_face_short_range.tflite
COPY . /app/

ENV PYTHONPATH=/app
# Configure Ultralytics to use a writable directory and suppress messages
ENV YOLO_CONFIG_DIR=/app/.yolo
ENV YOLO_VERBOSE=False
RUN mkdir -p /app/.yolo

# Pre-download YOLOv8 model to avoid runtime download
# This speeds up first run and works offline
# Set config dir first so settings file is created in the right place
RUN python -c "import os; os.environ['YOLO_CONFIG_DIR']='/app/.yolo'; from ultralytics import YOLO; YOLO('yolov8n.pt')" 2>&1 | grep -v "Creating new Ultralytics" || true

CMD ["python", "pipeline.py", "--help"]
