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

## API Endpoints

| Endpoint                    | Description                      |
| --------------------------- | -------------------------------- |
| `GET /api/photos`           | List with filters                |
| `GET /api/photos/[id]/jpeg` | Download original (rate limited) |
| `PATCH /api/photos/[id]`    | Update metadata (admin)          |
| `DELETE /api/photos/[id]`   | Delete (admin)                   |
