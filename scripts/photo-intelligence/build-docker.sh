#!/bin/bash
# Build script for Docker image

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🐳 Building Photo Intelligence Docker image..."
echo ""

# Build the image
docker build -t bottb-photo-intelligence:latest .

echo ""
echo "✅ Build complete!"
echo ""
echo "To run the pipeline:"
echo "  docker run --rm \\"
echo "    -v /Volumes/Extreme\\ SSD/Photos:/photos:ro \\"
echo "    -v \$(pwd)/output:/app/output \\"
echo "    bottb-photo-intelligence:latest \\"
echo "    python pipeline.py /photos /app/output --batch-size 100 --verbose"
echo ""
echo "Or use docker-compose:"
echo "  docker-compose up"


