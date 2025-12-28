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
npm run bulk-upload-photos <directory> <event-id>
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

## Slideshow Features

- Navigation: buttons, keyboard, swipe, thumbnails
- URL updates for deep linking
- Download original, copy link, share to social
- Admin: delete, crop, set hero labels

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
