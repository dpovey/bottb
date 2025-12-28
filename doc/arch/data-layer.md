# Data Layer

Database schema, TypeScript types, and query patterns.

## Database

- **Provider**: Neon Postgres via `@vercel/postgres`
- **Schema**: `src/lib/schema.sql`
- **Types/Queries**: `src/lib/db.ts`

## Migrations

Uses [node-pg-migrate](https://github.com/salsita/node-pg-migrate) for production (Vercel/Neon) schema changes.

### Commands

| Command                         | Purpose                               |
| ------------------------------- | ------------------------------------- |
| `npm run migrate`               | Apply pending migrations to Vercel DB |
| `npm run migrate:create <name>` | Create a new migration file           |
| `npm run migrate:status`        | Preview pending migrations (dry run)  |

### Workflow

1. Create migration: `npm run migrate:create add-foo-column`
2. Edit the generated file in `migrations/` with SQL
3. Apply to Vercel DB: `npm run migrate`
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

| Phase          | Changes                                                                   |
| -------------- | ------------------------------------------------------------------------- |
| Core           | events, bands, votes, users tables                                        |
| UUID to Slugs  | Changed event/band IDs from UUIDs to human-readable slugs                 |
| Crowd Features | crowd_noise_measurements table, crowd_score column                        |
| Scoring 2026   | visuals column for costumes/visual presentation scoring                   |
| Companies      | companies table to group bands by organization                            |
| Photos         | photos table with labels, hero_focal_point, responsive variants           |
| Photographers  | photographers table with profile info                                     |
| Videos         | videos table for YouTube integration                                      |
| Setlists       | setlist_songs table with conflict detection                               |
| Social         | social_accounts, social_posts, social_post_templates, social_post_results |

### Notes

- Migrations only run manually (not in CI/deploy) - you control when production changes
- Test databases use `schema.sql` via `npm run setup-db` (fresh each time)
- The `pgmigrations` table tracks applied migrations in production

### E2E Test Database

E2E tests use Docker Postgres (see `doc/testing/e2e-testing.md`):

- `docker-compose.test.yml` - ephemeral Postgres 17 on port 5433
- `e2e/fixtures/` - JSON test data and cached pg_dump
- `npm run test:e2e` - seeds database and runs Playwright tests

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
