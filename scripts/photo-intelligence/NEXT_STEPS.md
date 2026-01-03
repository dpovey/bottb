# Photo Intelligence Pipeline - Next Steps

## Current Status

The pipeline is processing photos from `/Volumes/Extreme SSD/Photos`. It will:

1. Find all image files (recursively, skipping macOS files)
2. Process them in batches of 100
3. Generate intelligence data (hashes, embeddings, crops, face detections)
4. Save results to `photo-intelligence-output/`

## Step 1: Wait for Pipeline to Complete

The pipeline will create these output files:

- `photos.parquet` - Summary data (filename, dimensions, hash counts)
- `photos.json` - Full results (embeddings, crops, faces, persons)
- `clusters.json` - Near-duplicate and scene clusters
- `people.json` - Person clusters

**Check progress:**

```bash
cd .worktrees/photo-intelligence
ls -lh photo-intelligence-output/
```

## Step 2: Upload Results to Database

Once the pipeline completes, upload the intelligence data:

```bash
cd .worktrees/photo-intelligence
npx tsx src/scripts/photo-intelligence/upload-intelligence.ts \
  ./photo-intelligence-output \
  --verbose
```

**Options:**

- `--dry-run` - Preview what would be uploaded without actually uploading
- `--version <v>` - Set intelligence pipeline version (default: "1.0.0")

This script will:

1. Match photos by filename to existing database records
2. Insert crop data into `photo_crops` table
3. Insert hashes into `photo_hashes` table
4. Insert embeddings into `photo_embeddings` table
5. Insert face detections into `detected_faces` table
6. Insert clusters into `photo_clusters` table
7. Update `photos.intelligence_processed_at` and `photos.intelligence_version`

## Step 3: Use Intelligence Data in App

### Smart Cropping (Already Implemented)

The smart crop API is already available:

- **Endpoint:** `GET /api/photos/[photoId]/smart-crop?aspect=4:5`
- **Used in:** Social post composer (`ShareComposerModal`)
- **Status:** ✅ Ready to use once data is uploaded

### Photo Grouping (Admin UI)

View near-duplicate and scene clusters:

- **Page:** `/admin/photos/grouping`
- **Status:** ✅ UI created, needs API endpoints

**To complete:**

1. Create API endpoint: `GET /api/admin/photos/clusters?type=near_duplicate|scene`
2. Update `photo-grouping-client.tsx` to fetch from API

### Person Clusters (Admin UI)

Browse photos by person:

- **Page:** `/admin/photos/people`
- **Status:** ✅ UI created, needs API endpoints

**To complete:**

1. Create API endpoint: `GET /api/admin/photos/people/clusters`
2. Update `people-clusters-client.tsx` to fetch from API

## Step 4: Monitor and Iterate

### Check Processing Status

```sql
-- See how many photos have been processed
SELECT
  COUNT(*) as total_photos,
  COUNT(intelligence_processed_at) as processed,
  COUNT(*) - COUNT(intelligence_processed_at) as pending
FROM photos;
```

### Re-run Pipeline for New Photos

To process only new photos (skip existing):

```bash
# First, export existing filenames
npx tsx -e "
import { sql } from '@vercel/postgres';
const result = await sql\`SELECT original_filename FROM photos WHERE original_filename IS NOT NULL\`;
const filenames = result.rows.map(r => r.original_filename);
require('fs').writeFileSync('existing-filenames.json', JSON.stringify(filenames));
"

# Then run pipeline with --skip-existing
npx tsx src/scripts/photo-intelligence/run-pipeline.ts \
  "/Volumes/Extreme SSD/Photos" \
  --output-dir ./photo-intelligence-output \
  --python-venv scripts/photo-intelligence/.venv \
  --skip-existing \
  --existing-filenames existing-filenames.json \
  --verbose
```

## Troubleshooting

### Pipeline Errors

If the pipeline fails:

1. Check Python dependencies: `source scripts/photo-intelligence/.venv/bin/activate && python -c "import mediapipe, ultralytics, sentence_transformers"`
2. Check disk space: `df -h`
3. Check logs in terminal output

### Upload Errors

If upload fails:

1. Check database connection: `echo $DATABASE_URL`
2. Verify output files exist: `ls -lh photo-intelligence-output/`
3. Use `--dry-run` to preview changes
4. Check for filename mismatches (case sensitivity, special characters)

### Missing Intelligence Data

If photos don't have intelligence data:

1. Verify photos exist in database: `SELECT id, original_filename FROM photos LIMIT 10`
2. Check filename matching (case-sensitive)
3. Re-run upload script with `--verbose` to see matching details

## Future Enhancements

1. **Background Processing** - Run pipeline as a background job
2. **Incremental Updates** - Only process new/changed photos
3. **API Endpoints** - Complete the admin UI API endpoints
4. **Face Recognition** - Install dlib/cmake for better face recognition (currently using MediaPipe)
5. **Performance** - Optimize clustering for large photo sets
6. **Caching** - Cache embeddings and crops for faster retrieval
