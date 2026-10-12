# Photo Intelligence Pipeline

Local processing pipeline for BoTTB photos that generates:

- Smart crop boxes (people-first)
- Photo grouping (near-duplicates and scenes)
- Person identification across photos

## Setup

1. Create a virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

Note: Some dependencies (like `face-recognition` and `ultralytics`) may require system libraries. See individual package documentation for setup.

## Usage

The pipeline is orchestrated from Node.js. See `src/scripts/photo-intelligence/run-pipeline.ts`.

Near-duplicate grouping also runs on its own, with only Pillow, imagehash, numpy and
opencv-python (no torch/YOLO/face_recognition):

```bash
python -I group_duplicates.py <photo_dir> <out_dir>   # writes clusters.json + review.json
```

See `ml_services/duplicate_grouping.py` and the Near-Duplicate section of `doc/arch/photos.md`.

## Architecture

- `ml_services/` - Individual ML service modules
- `pipeline.py` - Main orchestrator that processes photos in batches
- Outputs: `photos.parquet`, `clusters.json`, `people.json`
