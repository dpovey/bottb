# Data Layer

Database schema, TypeScript types, and query patterns.

## Database

- **Provider**: Neon Postgres via `@vercel/postgres`
- **Schema**: `src/lib/schema.sql`
- **Types/Queries**: `src/lib/db.ts`

## Core Tables

| Table       | Primary Key | Description                                 |
| ----------- | ----------- | ------------------------------------------- |
| `events`    | `id` (UUID) | Event with name, date, location, status     |
| `bands`     | `id` (UUID) | Band with event_id, company_slug, order     |
| `votes`     | `id` (UUID) | Vote with band_id, voter_type, fingerprints |
| `companies` | `slug`      | Company with name, logo_url, icon_url       |

## Supporting Tables

| Table               | Description                               |
| ------------------- | ----------------------------------------- |
| `photos`            | Photo with blob URLs, labels, focal_point |
| `photographers`     | Photographer profiles                     |
| `setlist_songs`     | Songs with band_id, position, song_type   |
| `finalized_results` | Cached event results (JSONB)              |
| `users`             | Admin users with password_hash            |
| `social_accounts`   | OAuth tokens for LinkedIn/Meta            |

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
