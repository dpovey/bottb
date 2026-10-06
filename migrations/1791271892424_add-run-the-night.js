/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * "Run the night" (see doc/requirements/run-the-night.md).
 *
 * Everything here is additive, so the previous deploy keeps working against
 * the migrated database:
 *
 * - `events.status` gains `closed` (crowd voting closed, votes being reviewed)
 *   and `locked` (results frozen but not yet public) between `voting` and
 *   `finalized`. `finalized` keeps its meaning: results are public.
 * - `events.is_test` marks a rehearsal event that is hidden from every public
 *   listing, the sitemap and the search index.
 * - `votes.status` gains `rejected` so a reviewed duplicate is kept as an
 *   audit trail rather than deleted; `reviewed_at` / `reviewed_by` record the
 *   decision.
 * - `event_status_log` records every lifecycle transition and who made it.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.sql(`ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check`)
  pgm.sql(`
    ALTER TABLE events ADD CONSTRAINT events_status_check
    CHECK (status::text = ANY (ARRAY['upcoming', 'voting', 'closed', 'locked', 'finalized']::text[]))
  `)
  pgm.sql(
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false`
  )

  pgm.sql(`ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_status_check`)
  pgm.sql(`
    ALTER TABLE votes ADD CONSTRAINT votes_status_check
    CHECK (status::text = ANY (ARRAY['approved', 'pending', 'rejected']::text[]))
  `)
  pgm.sql(
    `ALTER TABLE votes ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone`
  )
  pgm.sql(
    `ALTER TABLE votes ADD COLUMN IF NOT EXISTS reviewed_by character varying(255)`
  )

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS event_status_log (
      id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      event_id    character varying(255) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      transition  character varying(40) NOT NULL,
      from_status character varying(20) NOT NULL,
      to_status   character varying(20) NOT NULL,
      actor       character varying(255),
      details     jsonb DEFAULT '{}'::jsonb NOT NULL,
      created_at  timestamp with time zone DEFAULT now() NOT NULL
    )
  `)
  pgm.sql(
    `CREATE INDEX IF NOT EXISTS idx_event_status_log_event ON event_status_log(event_id, created_at)`
  )
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS event_status_log`)

  // Fold the new values back into the old ones before restoring the old
  // constraints: a mid-night event goes back to `voting`, and a rejected vote
  // back to `pending` (the old schema counted pending votes).
  pgm.sql(`UPDATE votes SET status = 'pending' WHERE status = 'rejected'`)
  pgm.sql(`ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_status_check`)
  pgm.sql(`
    ALTER TABLE votes ADD CONSTRAINT votes_status_check
    CHECK (status::text = ANY (ARRAY['approved', 'pending']::text[]))
  `)
  pgm.sql(`ALTER TABLE votes DROP COLUMN IF EXISTS reviewed_at`)
  pgm.sql(`ALTER TABLE votes DROP COLUMN IF EXISTS reviewed_by`)

  pgm.sql(
    `UPDATE events SET status = 'voting' WHERE status IN ('closed', 'locked')`
  )
  pgm.sql(`ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check`)
  pgm.sql(`
    ALTER TABLE events ADD CONSTRAINT events_status_check
    CHECK (status::text = ANY (ARRAY['upcoming', 'voting', 'finalized']::text[]))
  `)
  pgm.sql(`ALTER TABLE events DROP COLUMN IF EXISTS is_test`)
}
