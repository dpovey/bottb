import { sql } from '../sql'
import type { Event, VideographerWithStats } from '../db-types'

// ============================================================
// Videographer Functions
//
// A videographer shoots a whole event, so videographers are
// linked to events via the `event_videographers` join table
// (mirrors the photographers feature, which links by photo).
// ============================================================

/**
 * Get all videographers with a count of events they've filmed.
 */
export async function getVideographers(): Promise<VideographerWithStats[]> {
  const { rows } = await sql<VideographerWithStats>`
    SELECT
      v.*,
      COALESCE(ec.event_count, 0)::int as event_count
    FROM videographers v
    LEFT JOIN (
      SELECT videographer_slug, COUNT(*)::int as event_count
      FROM event_videographers
      GROUP BY videographer_slug
    ) ec ON v.slug = ec.videographer_slug
    ORDER BY v.name ASC
  `
  return rows
}

/**
 * Get a single videographer by slug, with their event count.
 */
export async function getVideographerBySlug(
  slug: string
): Promise<VideographerWithStats | null> {
  const { rows } = await sql<VideographerWithStats>`
    SELECT
      v.*,
      COALESCE(ec.event_count, 0)::int as event_count
    FROM videographers v
    LEFT JOIN (
      SELECT videographer_slug, COUNT(*)::int as event_count
      FROM event_videographers
      GROUP BY videographer_slug
    ) ec ON v.slug = ec.videographer_slug
    WHERE v.slug = ${slug}
  `
  return rows[0] || null
}

/**
 * Get the events a videographer has filmed, newest first.
 */
export async function getVideographerEvents(slug: string): Promise<Event[]> {
  const { rows } = await sql<Event>`
    SELECT e.*
    FROM events e
    JOIN event_videographers ev ON ev.event_id = e.id
    WHERE ev.videographer_slug = ${slug}
    ORDER BY e.date DESC
  `
  return rows
}

/**
 * Get every event↔videographer link (used by the admin screen to pre-fill
 * each videographer's assigned events).
 */
export async function getEventVideographerLinks(): Promise<
  { event_id: string; videographer_slug: string }[]
> {
  const { rows } = await sql<{ event_id: string; videographer_slug: string }>`
    SELECT event_id, videographer_slug FROM event_videographers
  `
  return rows
}

/**
 * Replace the set of events a videographer is tagged on.
 * Only tags events that actually exist (invalid ids are skipped).
 */
export async function setVideographerEvents(
  slug: string,
  eventIds: string[]
): Promise<void> {
  await sql`DELETE FROM event_videographers WHERE videographer_slug = ${slug}`
  for (const eventId of eventIds) {
    await sql`
      INSERT INTO event_videographers (event_id, videographer_slug)
      SELECT ${eventId}, ${slug}
      WHERE EXISTS (SELECT 1 FROM events WHERE id = ${eventId})
      ON CONFLICT DO NOTHING
    `
  }
}
