# Data Layer

Database schema, TypeScript types, and query patterns.

## Database

- **Provider**: Neon Postgres via `@vercel/postgres`
- **Schema**: `src/lib/schema.sql`
- **Types/Queries**: `src/lib/db.ts`

## Migrations

Uses [node-pg-migrate](https://github.com/salsita/node-pg-migrate) for production (Vercel/Neon) schema changes.

### Commands

| Command                      | Purpose                               |
| ---------------------------- | ------------------------------------- |
| `pnpm migrate`               | Apply pending migrations to Vercel DB |
| `pnpm migrate:create <name>` | Create a new migration file           |
| `pnpm migrate:status`        | Preview pending migrations (dry run)  |

### Workflow

1. Create migration: `pnpm migrate:create add-foo-column`
2. Edit the generated file in `migrations/` with SQL
3. Apply to Vercel DB: `pnpm migrate`
4. Update `src/lib/schema.sql` to match
5. Commit both migration file and schema.sql

### Files

| File                  | Purpose                        |
| --------------------- | ------------------------------ |
| `migrations/*.js`     | Versioned migration files      |
| `src/lib/schema.sql`  | Full schema for fresh test DBs |
| `migrate-config.json` | node-pg-migrate configuration  |

### Schema Evolution

The database evolved through these phases (archived scripts in `src/scripts/archive/`):

| Phase              | Changes                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Core               | events, bands, votes, users tables                                                                                                          |
| UUID to Slugs      | Changed event/band IDs from UUIDs to human-readable slugs                                                                                   |
| Crowd Features     | crowd_noise_measurements table, crowd_score column                                                                                          |
| Scoring 2026       | visuals column for costumes/visual presentation scoring                                                                                     |
| Companies          | companies table to group bands by organization                                                                                              |
| Photos             | photos table with labels, hero_focal_point, responsive variants                                                                             |
| Photographers      | photographers table with profile info                                                                                                       |
| Videos             | videos table for YouTube integration                                                                                                        |
| Setlists           | setlist_songs table with conflict detection                                                                                                 |
| Social             | social_accounts, social_posts, social_post_templates, social_post_results                                                                   |
| Photo Intelligence | photo_crops, photo_hashes, photo_embeddings, detected_faces, photo_clusters tables; intelligence_processed_at, intelligence_version columns |

### Notes

- Migrations only run manually (not in CI/deploy) - you control when production changes
- Test databases use `schema.sql` via `pnpm setup-db` (fresh each time)
- The `pgmigrations` table tracks applied migrations in production

### E2E Test Database

E2E tests use Docker Postgres (see `doc/testing/e2e-testing.md`):

- `docker-compose.test.yml` - ephemeral Postgres 17 on port 5433
- `e2e/fixtures/` - JSON test data and cached pg_dump
- `pnpm test:e2e` - seeds database and runs Playwright tests

## Core Tables

| Table       | Primary Key | Description                                 |
| ----------- | ----------- | ------------------------------------------- |
| `events`    | `id` (UUID) | Event with name, date, location, status     |
| `bands`     | `id` (UUID) | Band with event_id, company_slug, order     |
| `votes`     | `id` (UUID) | Vote with band_id, voter_type, fingerprints |
| `companies` | `slug`      | Company with name, logo_url, icon_url       |

## Supporting Tables

| Table               | Description                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `photos`            | Photo with blob URLs, labels, focal_point, intelligence metadata |
| `photographers`     | Photographer profiles                                            |
| `setlist_songs`     | Songs with band_id, position, song_type                          |
| `finalized_results` | Cached event results (JSONB)                                     |
| `users`             | Admin users with password_hash                                   |
| `social_accounts`   | OAuth tokens for LinkedIn/Meta                                   |

## Photo Intelligence Tables

ML-powered photo analysis and organization.

| Table              | Description                                    |
| ------------------ | ---------------------------------------------- |
| `photo_crops`      | Smart crop boxes for different aspect ratios   |
| `photo_hashes`     | Perceptual hashes for near-duplicate detection |
| `photo_embeddings` | Image embeddings for scene clustering          |
| `detected_faces`   | Face detections with embeddings                |
| `photo_clusters`   | Clusters (near-duplicates, scenes, people)     |

### `photo_crops`

Smart crop boxes calculated by ML pipeline:

- `photo_id` (UUID, FK)
- `aspect_ratio` (VARCHAR): '4:5', '16:9', '1:1', '9:16'
- `crop_box` (JSONB): `{x, y, width, height}` in pixels
- `confidence` (NUMERIC): 0.0-1.0
- `method` (VARCHAR): 'face', 'person', 'saliency'

### `photo_hashes`

Perceptual hashes for duplicate detection:

- `photo_id` (UUID, FK, unique)
- `phash` (VARCHAR): Perceptual hash
- `dhash` (VARCHAR): Difference hash

### `photo_embeddings`

Image embeddings for scene similarity:

- `photo_id` (UUID, FK)
- `embedding` (JSONB): 512-dimensional vector (CLIP)
- `model` (VARCHAR): 'clip' (currently only CLIP)

### `detected_faces`

Face detections with embeddings:

- `photo_id` (UUID, FK)
- `face_box` (JSONB): `{x, y, width, height}` bounding box
- `face_embedding` (JSONB): 128-dimensional vector
- `confidence` (NUMERIC): Detection confidence
- `quality_score` (NUMERIC): Face quality (size, position, sharpness)

### `photo_clusters`

Clusters of related photos:

- `id` (UUID, PK)
- `cluster_type` (VARCHAR): 'near_duplicate', 'scene', 'person'
- `photo_ids` (UUID[]): Array of photo IDs in cluster
- `representative_photo_id` (UUID, FK, nullable)
- `metadata` (JSONB): Cluster-specific data

### `photos` (updated)

New columns for intelligence tracking:

- `intelligence_processed_at` (TIMESTAMP): When photo was processed
- `intelligence_version` (VARCHAR): Pipeline version (e.g., "1.0.0")

## Key Types

- `Event`: id, name, date, location, timezone, status, is_active, info (JSONB)
- `Band`: id, event_id, name, company_slug, order, info (JSONB)
- `Vote`: id, event_id, band_id, voter_type, scores, fingerprints
- `Photo`: id, event_id, band_id, blob_url, thumbnail_url, labels[]

## Query Functions

- `getEvents()`, `getActiveEvent()`, `getEventById(id)`
- `getBandsForEvent(eventId)`, `getBandById(id)`
- `submitVote(vote)`, `checkExistingVote(fingerprint)`
- `getPhotos(filters)`, `getPhotoById(id)`
- `getBandScores(eventId)`, `getFinalizedResults(eventId)`

## Finalized Results

**Critical**: Always check for finalized results first:

```
if (event.status === 'finalized') → getFinalizedResults()
else → getBandScores() (dynamic calculation)
```

Benefits: Performance, data integrity, consistency.
