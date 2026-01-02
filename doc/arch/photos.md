# Photo Gallery

Photo upload, storage, and gallery display.

## Storage

- **Provider**: Vercel Blob
- **Variants**: thumbnail (300x300 WebP), large (2000px WebP), original (JPEG)
- **Processing**: Sharp for resizing/format conversion

## Photo Data

- `blob_url`, `thumbnail_url`, `large_url`
- `event_id`, `band_id`, `photographer_slug`
- `labels[]`: `band_hero`, `event_hero`, `global_hero`, `featured`
- `focal_point`: { x, y } for hero crops

## Upload Methods

### Bulk Upload (CLI)

```bash
pnpm bulk-upload-photos <directory> <event-id>
```

- Extracts EXIF/XMP metadata
- Matches photographer from XMP
- Generates variants

### API Upload

- `POST /api/upload/image` with FormData
- Requires admin auth

## Gallery Features

- Responsive grid with lazy loading
- Filtering by event, band, photographer, company
- URL state for shareable filters

### Shuffle & Ordering

- **Default**: Shuffle on (randomized order)
- **URL param**: `?shuffle=true` (shared seed) or `?shuffle=<seed>` (specific seed)
- **Two-tier model**:
  - `?shuffle=true` → time-based seed (15-min bucket), same order for all users in window
  - `?shuffle=<seed>` → specific seed for shareable links with exact order
  - No param → chronological by date
- **Deterministic**: Seeded PRNG (mulberry32) ensures same seed = same order

### Type-Safe Shuffle Architecture

To prevent parameter confusion bugs, shuffle logic is centralized in `src/lib/shuffle-types.ts`:

| Export                  | Purpose                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `ShuffleParam`          | Type for shuffle URL param (`'true'` \| string \| null)                             |
| `ShuffleState`          | Resolved state after API call (`{ enabled, seed }`)                                 |
| `buildPhotoApiParams()` | Type-safe API param builder (always uses `shuffle`, never `seed` or `order=random`) |
| `buildSlideshowUrl()`   | Type-safe slideshow URL builder                                                     |
| `parseShuffleFromUrl()` | Parse shuffle from URL search params                                                |
| `generateShuffleSeed()` | Generate random shuffle seed                                                        |

**Important**: Always use `buildPhotoApiParams()` for API calls to ensure consistent parameter naming. Never use `order=random&seed=X` pattern (deprecated).

### useShuffledPhotos Hook

For components that need shuffle state management, use `useShuffledPhotos` from `src/lib/hooks/use-shuffled-photos.ts`:

```tsx
const {
  photos,
  shuffle,
  toggleShuffle,
  reshuffle,
  loadMore,
  buildSlideshowUrl,
} = useShuffledPhotos({
  eventId: 'event-123',
  initialShuffle: 'true',
})

// Navigate to slideshow preserving shuffle order
router.push(buildSlideshowUrl(photos[0].id))
```

Benefits:

- Single source of truth for shuffle behavior
- Type-safe API params via `buildPhotoApiParams()`
- Consistent URL building via `buildSlideshowUrl()`
- Handles seed resolution from API response
- Pagination with infinite scroll support

### Caching

- **TTL**: 15 minutes (`cacheLife('fifteenMinutes')`)
- **Cache key**: filters + shuffle seed
- **Cache tags**: `photos`, filter values for targeted invalidation
- **Implementation**: `getCachedPhotos()` in `src/lib/nav-data.ts`

## Slideshow Features

- Navigation: buttons, keyboard, swipe, thumbnails
- URL updates for deep linking
- Download original, copy link, share to social
- Admin: delete, crop, set hero labels
- Shuffle button synced with gallery state

## Hero Labels

| Label         | Usage             |
| ------------- | ----------------- |
| `band_hero`   | Band page banner  |
| `event_hero`  | Event page banner |
| `global_hero` | Home page banner  |
| `featured`    | Carousels         |

## Photo Intelligence Pipeline

ML-powered processing for smart cropping, photo grouping, and person identification.

### Overview

The photo intelligence pipeline processes photos locally to generate:

- **Smart crop boxes** for different aspect ratios (people-first framing)
- **Perceptual hashes** for near-duplicate detection
- **Image embeddings** for scene-level clustering
- **Face detections and embeddings** for person identification
- **Clustering results** (near-duplicates, scenes, people)

### Pipeline Architecture

```
Raw Photos → Python ML Services → Node.js Orchestrator → Database
                ↓
        - Face Detection (MediaPipe)
        - Person Detection (YOLOv8)
        - Perceptual Hashing
        - Image Embeddings (CLIP)
        - Face Embeddings
        - Smart Crop Calculation
```

### Processing Flow

1. **Local Processing** (`scripts/photo-intelligence/pipeline.py`):
   - Recursively scans photo directory
   - Processes photos in batches with checkpointing
   - Generates intelligence data (crops, hashes, embeddings, faces)
   - Outputs JSON/Parquet files

2. **Upload** (`src/scripts/photo-intelligence/upload-intelligence.ts`):
   - Matches photos by filename
   - Uploads intelligence data to database
   - Calculates and sets focal points (from face/person detections)
   - Regenerates thumbnails using smart crops

3. **Usage**:
   - Smart crops used in social media posting
   - Clusters browsable in admin UI
   - Focal points used for hero images and thumbnails

## Smart Crops

Automatically calculated crop boxes for specific aspect ratios, prioritizing people/faces.

**Crop Calculation Logic:**

- **People-first framing**: Prioritizes faces, then persons, then saliency
- **Headroom protection**: Ensures heads are never cut off, even when person is near image edges
- **Maximal crops**: Uses maximum possible area while maintaining target aspect ratio
- **Edge case handling**: When person is near top/bottom, crop adjusts to include head with minimum 5% headroom

### Database Schema

**Table**: `photo_crops`

```sql
- photo_id (UUID, FK)
- aspect_ratio (VARCHAR): '4:5', '16:9', '1:1', '9:16'
- crop_box (JSONB): {x, y, width, height} in pixels
- confidence (NUMERIC): 0.0-1.0
- method (VARCHAR): 'face', 'person', 'saliency'
- created_at (TIMESTAMP)
```

### API Endpoint

**GET** `/api/photos/[photoId]/smart-crop?aspect=4:5`

Returns crop box for specified aspect ratio. Used by social media posting.

**Response**:

```json
{
  "photo_id": "uuid",
  "aspect_ratio": "4:5",
  "crop_box": { "x": 100, "y": 50, "width": 800, "height": 1000 },
  "confidence": 0.9,
  "method": "face",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Usage in Social Media

Smart crops are automatically applied when posting to Instagram/Facebook:

- Instagram: 4:5 aspect ratio
- Facebook: 16:9 or 1:1
- Crop info included in post payload

**Implementation**: `src/components/photos/share-composer-modal.tsx` uses `src/lib/social/smart-crops.ts`

## Thumbnail Generation

High-quality, multi-resolution thumbnails for optimal display across device densities.

### Standards

- **Resolutions**: 1x (300×300), 2x (600×600), 3x (900×900)
- **Quality**: WebP 85 (consistent across all generators)
- **Format**: WebP
- **Storage**: URLs stored in `photos.xmp_metadata`

### Generation Locations

1. **Initial Upload** (`src/lib/image-processor.ts`):
   - Uses Sharp's `position: 'attention'` (automatic saliency)
   - Creates all 3 variants if source is large enough

2. **Smart Crop Regeneration** (`src/scripts/photo-intelligence/upload-intelligence.ts`):
   - Triggered when focal points are calculated
   - Uses smart crop (1:1) or focal point for cropping
   - Creates all 3 variants

3. **Manual Crop** (`src/app/api/photos/[photoId]/crop/route.ts`):
   - Admin-selected crop area
   - Creates all 3 variants

### Database Storage

Thumbnail URLs stored in `photos.xmp_metadata`:

```json
{
  "thumbnail_url": "https://.../thumbnail-{timestamp}.webp",
  "thumbnail_2x_url": "https://.../thumbnail-2x-{timestamp}.webp",
  "thumbnail_3x_url": "https://.../thumbnail-3x-{timestamp}.webp",
  "thumbnail_version": 1234567890
}
```

### Frontend Usage

Database queries retrieve all variants for responsive `srcset`:

```typescript
COALESCE(p.xmp_metadata->>'thumbnail_url', ...) as thumbnail_url,
p.xmp_metadata->>'thumbnail_2x_url' as thumbnail_2x_url,
p.xmp_metadata->>'thumbnail_3x_url' as thumbnail_3x_url
```

### Responsive srcset Utilities

Shared utilities in `src/lib/photo-srcset.ts` build srcset strings:

| Function | Purpose | Output |
| --- | --- | --- |
| `buildThumbnailSrcSet(photo)` | Thumbnails (grids, strips) | `url 300w, url 600w, url 900w` |
| `getBestThumbnailSrc(photo)` | Best single thumbnail | 3x → 2x → 1x → blob_url |
| `buildHeroSrcSet(photo)` | Full-size images (hero, slideshow) | `url 1200w, url 2000w, url 4000w` |
| `getBestHeroSrc(photo, context)` | Best hero source for context | desktop: 4K, mobile: medium |

**Usage**:

```tsx
import { buildThumbnailSrcSet, getBestThumbnailSrc } from '@/lib/photo-srcset'

<img
  src={getBestThumbnailSrc(photo)}
  srcSet={buildThumbnailSrcSet(photo)}
  sizes="(max-width: 640px) 50vw, 25vw"
/>
```

Components using these utilities:
- `photo-card.tsx` - Gallery grid cards
- `photo-strip.tsx` - Horizontal photo strips
- `photo-slideshow.tsx` - Slideshow main image and thumbnails
- `event-card.tsx` - Event hero images
- `focal-point-image.tsx` - Hero sections with focal point
- `hero-carousel.tsx` - Home page carousel
- `WinnerDisplay.tsx` - Results page winner banner

## Focal Points vs Smart Crops

Two separate systems for different use cases.

### Hero Focal Points (`photos.hero_focal_point`)

- **Format**: Percentage-based `{x: 0-100, y: 0-100}`
- **Purpose**: CSS `object-position` for responsive cropping
- **Used for**: Hero images, thumbnails, event cards, social share images
- **Set by**: Admins manually OR automatically from photo intelligence
- **Storage**: Directly in `photos` table as JSONB
- **Default**: `{x: 50, y: 50}` (center)

### Smart Crops (`photo_crops` table)

- **Format**: Pixel-based `{x, y, width, height}` in pixels
- **Purpose**: Exact crop boxes for specific aspect ratios
- **Used for**: Social media posts (Instagram 4:5, Facebook 16:9, etc.)
- **Set by**: ML pipeline automatically
- **Storage**: Separate `photo_crops` table
- **Aspect ratios**: `4:5`, `16:9`, `1:1`, `9:16`

### How They Work Together

1. **Upload Script Protection**:
   - If photo has manual focal point (not default 50,50), smart crops are stored but existing crops are NOT overwritten
   - Preserves admin's manual crop decisions
   - Smart crops still stored for reference/suggestions

2. **Focal Point Calculation**:
   - Automatically calculated from face/person detections during upload
   - Uses best face center + headroom (15% above face)
   - Fallback: person center or smart crop center (1:1)
   - Only set if no manual focal point exists

3. **Thumbnail Regeneration**:
   - When focal point is set, thumbnails are regenerated using smart crop (1:1) or focal point
   - Creates all 3 variants (1x, 2x, 3x) at quality 85

4. **Hero Images**:
   - Use `hero_focal_point` via CSS `object-position`
   - Responsive cropping based on container aspect ratio

5. **Social Media Posts**:
   - Use smart crops from `photo_crops` table
   - Fetch via `/api/photos/[photoId]/smart-crop?aspect=4:5`

### Protection Rules

- ✅ **Safe to insert**: New smart crops (no existing crop for that aspect ratio)
- ✅ **Safe to update**: Existing smart crops IF no manual focal point exists
- ❌ **Skip update**: Existing smart crops IF manual focal point exists (preserve manual settings)
- ✅ **Auto-set focal point**: Only if no manual focal point exists (default 50,50 is considered "not set")

## Photo Clustering

Three types of clusters for organizing and discovering photos.

### Cluster Types

#### 1. Near-Duplicate Clusters

- **Type**: `'near_duplicate'`
- **Method**: Perceptual hashing (pHash/dHash) with Hamming distance
- **Contains**: Photos that are nearly identical (burst shots, minor variations)
- **Use case**: Finding and removing duplicate photos

#### 2. Scene Clusters

- **Type**: `'scene'`
- **Method**: Image embeddings (CLIP) with cosine similarity and DBSCAN clustering
- **Contains**: Photos of the same scene with different framing/crops
- **Use case**: Finding alternative angles of the same moment

#### 3. Person Clusters

- **Type**: `'person'`
- **Method**: Face embeddings with distance-based clustering
- **Contains**: All photos containing the same person
- **Use case**: "All photos of this guitarist" browsing

### Database Schema

**Table**: `photo_clusters`

```sql
- id (UUID, PK)
- cluster_type (VARCHAR): 'near_duplicate' | 'scene' | 'person'
- photo_ids (UUID[]): Array of photo IDs in cluster
- representative_photo_id (UUID, FK, nullable)
- metadata (JSONB): Cluster-specific data (e.g., representative face info)
- created_at (TIMESTAMP)
```

### Admin UI

**Pages**:

- `/admin/photos/grouping` - Browse near-duplicate and scene clusters
- `/admin/photos/people` - Browse person clusters

**API Endpoints**:

- `GET /api/admin/photos/clusters?type=near_duplicate|scene`
- `GET /api/admin/photos/people/clusters`
- `GET /api/admin/photos/people/clusters/[clusterId]/photos`

### Database Functions

- `getSimilarPhotos(photoId, type)` - Get similar photos (near-duplicates or scenes)
- `getPhotosByPerson(clusterId)` - Get all photos of a person
- `getPhotoClusters(photoId)` - Get all clusters containing a photo

## API Endpoints

| Endpoint                                | Description                      |
| --------------------------------------- | -------------------------------- |
| `GET /api/photos`                       | List with filters                |
| `GET /api/photos/[id]/jpeg`             | Download original (rate limited) |
| `GET /api/photos/[id]/smart-crop`       | Get smart crop for aspect ratio  |
| `PATCH /api/photos/[id]`                | Update metadata (admin)          |
| `DELETE /api/photos/[id]`               | Delete (admin)                   |
| `GET /api/admin/photos/clusters`        | Get clusters (admin)             |
| `GET /api/admin/photos/people/clusters` | Get people clusters (admin)      |
