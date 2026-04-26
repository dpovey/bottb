import { sql } from '../sql'
import type { Event } from '../db-types'

export async function getEvents() {
  const { rows } = await sql<Event>`SELECT * FROM events ORDER BY date DESC`
  return rows
}

export async function getActiveEvent() {
  const { rows } = await sql<Event>`
    SELECT * FROM events 
    WHERE is_active = true AND status = 'voting' 
    LIMIT 1
  `
  return rows[0] || null
}

export async function getUpcomingEvents() {
  const { rows } = await sql<Event>`
    SELECT * FROM events 
    WHERE date >= NOW() 
    ORDER BY date ASC
  `
  return rows
}

export async function getPastEvents() {
  const { rows } = await sql<Event>`
    SELECT * FROM events 
    WHERE date < NOW() 
    ORDER BY date DESC
  `
  return rows
}

export interface PastEventWithWinner extends Event {
  winner_band_name?: string
  winner_company_slug?: string
  winner_company_name?: string
  winner_company_icon_url?: string
}

/**
 * Get past events with winner info in a single efficient query.
 * Joins with finalized_results and bands to get winner company info.
 */
export async function getPastEventsWithWinners(): Promise<
  PastEventWithWinner[]
> {
  const { rows } = await sql<PastEventWithWinner>`
    SELECT 
      e.*,
      COALESCE(fr.band_name, e.info->>'winner') as winner_band_name,
      COALESCE(b.company_slug, b_name.company_slug, NULL) as winner_company_slug,
      COALESCE(c.name, c_name.name, NULL) as winner_company_name,
      COALESCE(c.icon_url, c_name.icon_url, NULL) as winner_company_icon_url
    FROM events e
    LEFT JOIN finalized_results fr ON fr.event_id = e.id AND fr.final_rank = 1
    LEFT JOIN bands b ON b.id = COALESCE(fr.band_id, e.info->>'winner_band_id')
    LEFT JOIN companies c ON c.slug = b.company_slug
    -- Also try to match winner by name for legacy events without winner_band_id
    LEFT JOIN bands b_name ON b_name.event_id = e.id 
      AND LOWER(b_name.name) = LOWER(e.info->>'winner')
      AND fr.band_id IS NULL 
      AND e.info->>'winner_band_id' IS NULL
    LEFT JOIN companies c_name ON c_name.slug = b_name.company_slug
    WHERE e.date < NOW()
    ORDER BY e.date DESC
  `
  return rows
}

export async function getEventById(eventId: string) {
  const { rows } = await sql<Event>`
    SELECT * FROM events WHERE id = ${eventId}
  `
  return rows[0] || null
}

export async function updateEventStatus(
  eventId: string,
  status: 'upcoming' | 'voting' | 'finalized'
) {
  const { rows } = await sql<Event>`
    UPDATE events 
    SET status = ${status}
    WHERE id = ${eventId}
    RETURNING *
  `
  return rows[0] || null
}

/**
 * Calculate band scores dynamically from votes
 *
 * ⚠️ IMPORTANT: Do NOT use this for finalized events!
 *
 * For finalized events, use `getFinalizedResults()` instead. This function:
 * - Runs expensive SQL queries with CTEs and aggregations
 * - Calculates scores from live vote data (which may change)
 * - Should only be used for non-finalized events or admin preview
 *
 * @param eventId - The event ID
 * @returns Array of band scores with calculated averages
 *
 * @see getFinalizedResults - Use this for finalized events
 * @see hasFinalizedResults - Check if finalized results exist
 */
export async function getBandScores(eventId: string) {
  const { rows } = await sql`
    WITH total_votes AS (
      SELECT COUNT(*) as total_crowd_votes
      FROM votes v
      JOIN bands b ON v.band_id = b.id
      WHERE b.event_id = ${eventId} AND v.voter_type = 'crowd'
    )
    SELECT 
      b.id,
      b.name,
      b."order",
      b.info,
      b.description,
      b.company_slug,
      c.name as company_name,
      c.icon_url as company_icon_url,
      (SELECT blob_url FROM photos WHERE band_id = b.id AND 'band_hero' = ANY(labels) LIMIT 1) as hero_thumbnail_url,
      (SELECT hero_focal_point FROM photos WHERE band_id = b.id AND 'band_hero' = ANY(labels) LIMIT 1) as hero_focal_point,
      AVG(CASE WHEN v.voter_type = 'judge' THEN v.song_choice END) as avg_song_choice,
      AVG(CASE WHEN v.voter_type = 'judge' THEN v.performance END) as avg_performance,
      AVG(CASE WHEN v.voter_type = 'judge' THEN v.crowd_vibe END) as avg_crowd_vibe,
      AVG(CASE WHEN v.voter_type = 'judge' THEN v.visuals END) as avg_visuals,
      AVG(CASE WHEN v.voter_type = 'crowd' THEN v.crowd_vote END) as avg_crowd_vote,
      COUNT(CASE WHEN v.voter_type = 'crowd' THEN 1 END) as crowd_vote_count,
      COUNT(CASE WHEN v.voter_type = 'judge' THEN 1 END) as judge_vote_count,
      tv.total_crowd_votes,
      cnm.energy_level as crowd_noise_energy,
      cnm.peak_volume as crowd_noise_peak,
      cnm.crowd_score
    FROM bands b
    LEFT JOIN companies c ON b.company_slug = c.slug
    LEFT JOIN votes v ON b.id = v.band_id
    LEFT JOIN crowd_noise_measurements cnm ON b.id = cnm.band_id AND cnm.event_id = ${eventId}
    CROSS JOIN total_votes tv
    WHERE b.event_id = ${eventId}
    GROUP BY b.id, b.name, b."order", b.info, b.description, b.company_slug, c.name, c.icon_url, tv.total_crowd_votes, cnm.energy_level, cnm.peak_volume, cnm.crowd_score
    ORDER BY b."order"
  `
  return rows
}
