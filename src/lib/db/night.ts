/**
 * Database access for "Run the night": lifecycle transitions, held-vote
 * review, judge sheets and the rehearsal ("test") event.
 *
 * Every write that is only allowed in certain event statuses repeats that
 * condition in its own WHERE clause, so a write racing a transition cannot
 * land after the status has moved on.
 */

import { createHash, randomBytes } from 'crypto'
import { sql, sqlQuery } from '../sql'
import type { Event, VoteStatus } from '../db-types'
import {
  isEventLive,
  type EventStatus,
  type TransitionId,
} from '../event-lifecycle'
import type { ReviewVote } from '../vote-review'

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Move an event from one status to another, only if it is still in `from`.
 *
 * Returns the updated event, or `null` when the event was not in `from` (it
 * does not exist, or someone else moved it first). `is_active` is kept in step
 * with the status for the scripts that still read it.
 */
export async function transitionEventStatus(
  eventId: string,
  from: EventStatus,
  to: EventStatus
): Promise<Event | null> {
  const { rows } = await sql<Event>`
    UPDATE events
    SET status = ${to}, is_active = ${isEventLive(to)}
    WHERE id = ${eventId} AND status = ${from}
    RETURNING *
  `
  return rows[0] || null
}

export interface EventStatusLogEntry {
  id: string
  event_id: string
  transition: string
  from_status: string
  to_status: string
  actor: string | null
  details: Record<string, unknown>
  created_at: string
}

export async function logEventTransition(entry: {
  eventId: string
  transition: TransitionId
  from: EventStatus
  to: EventStatus
  actor: string | null
  details?: Record<string, unknown>
}): Promise<void> {
  await sql`
    INSERT INTO event_status_log (event_id, transition, from_status, to_status, actor, details)
    VALUES (
      ${entry.eventId}, ${entry.transition}, ${entry.from}, ${entry.to},
      ${entry.actor}, ${JSON.stringify(entry.details ?? {})}
    )
  `
}

/** Most recent transitions first. */
export async function getEventStatusLog(
  eventId: string,
  limit = 20
): Promise<EventStatusLogEntry[]> {
  const { rows } = await sql<EventStatusLogEntry>`
    SELECT * FROM event_status_log
    WHERE event_id = ${eventId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return rows
}

/**
 * Whether this event's results were frozen by the "Finalise results" step, as
 * opposed to being finalised before the lifecycle (and its audit log) existed.
 */
export async function wasLockedByRunTheNight(
  eventId: string
): Promise<boolean> {
  const { rows } = await sql`
    SELECT 1 FROM event_status_log
    WHERE event_id = ${eventId} AND transition = 'lock-results'
    LIMIT 1
  `
  return rows.length > 0
}

/** Names of other real events that currently have crowd voting open. */
export async function getOtherEventsVoting(eventId: string): Promise<string[]> {
  const { rows } = await sql<{ name: string }>`
    SELECT name FROM events
    WHERE status = 'voting' AND id <> ${eventId} AND is_test = false
    ORDER BY date
  `
  return rows.map((r) => r.name)
}

// ---------------------------------------------------------------------------
// Crowd votes
// ---------------------------------------------------------------------------

/** Every crowd vote for an event, oldest first, with the fields review needs. */
export async function getCrowdVotesForReview(
  eventId: string
): Promise<ReviewVote[]> {
  const { rows } = await sql<ReviewVote>`
    SELECT
      id, band_id, COALESCE(status, 'approved') AS status, created_at,
      host(ip_address) AS ip_address, user_agent, browser_name, os_name, os_version,
      device_type, screen_resolution, fingerprintjs_visitor_id, email,
      reviewed_at, reviewed_by
    FROM votes
    WHERE event_id = ${eventId} AND voter_type = 'crowd'
    ORDER BY created_at, id
  `
  return rows
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

/**
 * Set the status of specific crowd votes. Only takes effect while the event is
 * `voting` or `closed`; returns the ids that were actually changed.
 *
 * Moving a vote back to `pending` clears the review stamp.
 */
export async function setCrowdVoteStatus(
  eventId: string,
  voteIds: string[],
  status: VoteStatus,
  reviewer: string | null
): Promise<string[]> {
  if (voteIds.length === 0) return []
  const { rows } = await sqlQuery<{ id: string }>(
    // A parameter used in two places must be cast everywhere it appears, or
    // Postgres refuses it ("inconsistent types deduced for parameter").
    `UPDATE votes
     SET status = $1::varchar,
         reviewed_at = CASE WHEN $1::varchar = 'pending' THEN NULL ELSE NOW() END,
         reviewed_by = CASE WHEN $1::varchar = 'pending' THEN NULL ELSE $2::varchar END
     WHERE event_id = $3::varchar
       AND voter_type = 'crowd'
       AND id = ANY($4::uuid[])
       AND EXISTS (
         SELECT 1 FROM events e
         WHERE e.id = $3::varchar AND e.status IN ('voting', 'closed')
       )
     RETURNING id`,
    [status, reviewer, eventId, voteIds]
  )
  return rows.map((r) => r.id)
}

// ---------------------------------------------------------------------------
// Judge sheets
// ---------------------------------------------------------------------------

export interface JudgeScoreRow {
  id: string
  name: string
  band_id: string
  song_choice: number | null
  performance: number | null
  crowd_vibe: number | null
  visuals: number | null
  created_at: string
}

export async function getJudgeScores(
  eventId: string
): Promise<JudgeScoreRow[]> {
  const { rows } = await sql<JudgeScoreRow>`
    SELECT id, COALESCE(name, 'Unnamed judge') AS name, band_id,
      song_choice, performance, crowd_vibe, visuals, created_at
    FROM votes
    WHERE event_id = ${eventId} AND voter_type = 'judge'
    ORDER BY created_at, id
  `
  return rows
}

export async function hasJudgeSubmitted(
  eventId: string,
  judgeName: string
): Promise<boolean> {
  const { rows } = await sql`
    SELECT 1 FROM votes
    WHERE event_id = ${eventId} AND voter_type = 'judge'
      AND LOWER(TRIM(name)) = LOWER(TRIM(${judgeName}))
    LIMIT 1
  `
  return rows.length > 0
}

/**
 * The unique key for one judge's score for one band. Hashed because the
 * column is 64 characters wide and "event-judge name-band id" is not reliably
 * shorter than that.
 */
export function judgeVoteFingerprint(
  eventId: string,
  judgeName: string,
  bandId: string
): string {
  return createHash('sha256')
    .update(`judge|${eventId}|${judgeName.trim().toLowerCase()}|${bandId}`)
    .digest('hex')
}

export interface JudgeSheetRow {
  band_id: string
  song_choice: number
  performance: number
  crowd_vibe: number
  visuals: number | null
}

/**
 * Store one judge's whole sheet in a single statement, so a sheet is either
 * saved for every band or not at all. Refused (returns 0) unless the event is
 * `upcoming`, `voting` or `closed`.
 */
export async function insertJudgeSheet(
  eventId: string,
  judgeName: string,
  rows: JudgeSheetRow[],
  context: { ip_address: string | null; user_agent: string | null }
): Promise<number> {
  if (rows.length === 0) return 0
  const name = judgeName.trim()
  const values: unknown[] = [
    eventId,
    name,
    context.ip_address,
    context.user_agent,
  ]
  const tuples = rows.map((row) => {
    const base = values.length
    values.push(
      row.band_id,
      row.song_choice,
      row.performance,
      row.crowd_vibe,
      row.visuals,
      judgeVoteFingerprint(eventId, name, row.band_id)
    )
    return `($${base + 1}::varchar, $${base + 2}::int, $${base + 3}::int, $${base + 4}::int, $${base + 5}::int, $${base + 6}::varchar)`
  })

  const { rowCount } = await sqlQuery(
    `INSERT INTO votes (
       event_id, band_id, voter_type, name, status,
       song_choice, performance, crowd_vibe, visuals,
       vote_fingerprint, ip_address, user_agent
     )
     SELECT $1::varchar, v.band_id, 'judge', $2::varchar, 'approved',
       v.song_choice, v.performance, v.crowd_vibe, v.visuals,
       v.fingerprint, $3::inet, $4::text
     FROM (VALUES ${tuples.join(', ')})
       AS v(band_id, song_choice, performance, crowd_vibe, visuals, fingerprint)
     WHERE EXISTS (
       SELECT 1 FROM events e
       WHERE e.id = $1::varchar AND e.status IN ('upcoming', 'voting', 'closed')
     )`,
    values
  )
  return rowCount ?? 0
}

/**
 * Delete one judge's sheet so it can be re-entered. Only takes effect while
 * the event is `upcoming`, `voting` or `closed`; returns the rows removed.
 */
export async function deleteJudgeSheet(
  eventId: string,
  judgeName: string
): Promise<number> {
  const { rowCount } = await sql`
    DELETE FROM votes
    WHERE event_id = ${eventId} AND voter_type = 'judge'
      AND LOWER(TRIM(COALESCE(name, 'Unnamed judge'))) = LOWER(TRIM(${judgeName}))
      AND EXISTS (
        SELECT 1 FROM events e
        WHERE e.id = ${eventId} AND e.status IN ('upcoming', 'voting', 'closed')
      )
  `
  return rowCount ?? 0
}

// ---------------------------------------------------------------------------
// Rehearsal ("test") event
// ---------------------------------------------------------------------------

/** The one rehearsal event. Hidden from the public site by `is_test`. */
export const TEST_EVENT_ID = 'test-night'

const TEST_BANDS = [
  'The Dry Runs',
  'Soundcheck Sally',
  'Null Pointer Sisters',
  'Merge Conflict',
  'Rollback Kings',
]

/**
 * Special guests who open the rehearsal night: on the event's pages, but not
 * on the ballot or the judge sheet and never ranked, as ShipReX at Sydney 2026.
 */
export const TEST_GUEST_BAND = {
  id: `${TEST_EVENT_ID}-guests`,
  name: 'The Special Guests',
}

/**
 * Create the rehearsal event with five made-up competing bands and one
 * non-competing band of special guests, or return it if it already exists
 * (adding any band it is missing). The bands have no company, setlist or
 * photos, so nothing about them reaches company pages, song stats or the
 * gallery.
 */
export async function ensureTestEvent(scoringVersion: string): Promise<Event> {
  await sql`
    INSERT INTO events (id, name, date, location, timezone, status, is_active, is_test, info)
    VALUES (
      ${TEST_EVENT_ID}, 'Test Night (rehearsal)', NOW(), 'Rehearsal — not a real event',
      'Australia/Sydney', 'upcoming', false, true,
      ${JSON.stringify({ scoring_version: scoringVersion })}
    )
    ON CONFLICT (id) DO NOTHING
  `
  const { rows } = await sql<Event>`
    SELECT * FROM events WHERE id = ${TEST_EVENT_ID}
  `
  if (!rows[0]?.is_test) {
    // An event with this id exists but is not a rehearsal event. Never adopt it.
    throw new Error(`Event "${TEST_EVENT_ID}" exists and is not a test event`)
  }
  for (let i = 0; i < TEST_BANDS.length; i++) {
    await sql`
      INSERT INTO bands (id, event_id, name, description, "order")
      VALUES (
        ${`${TEST_EVENT_ID}-band-${i + 1}`}, ${TEST_EVENT_ID}, ${TEST_BANDS[i]},
        'Rehearsal band — not a real act', ${i + 1}
      )
      ON CONFLICT (id) DO NOTHING
    `
  }
  await sql`
    INSERT INTO bands (id, event_id, name, description, "order", info)
    VALUES (
      ${TEST_GUEST_BAND.id}, ${TEST_EVENT_ID}, ${TEST_GUEST_BAND.name},
      'Rehearsal special guests — not competing', 0,
      ${JSON.stringify({ non_competing: true })}
    )
    ON CONFLICT (id) DO NOTHING
  `
  return rows[0]
}

/**
 * Wipe the rehearsal event back to a clean "before voting" state: all votes,
 * judge sheets, frozen results and history go. Does nothing for a real event.
 */
export async function resetTestEvent(eventId: string): Promise<boolean> {
  const { rows } = await sql<Event>`
    UPDATE events
    SET status = 'upcoming', is_active = false, date = NOW()
    WHERE id = ${eventId} AND is_test = true
    RETURNING *
  `
  if (rows.length === 0) return false

  await sql`
    DELETE FROM votes WHERE event_id = ${eventId}
      AND EXISTS (SELECT 1 FROM events e WHERE e.id = ${eventId} AND e.is_test)
  `
  await sql`
    DELETE FROM finalized_results WHERE event_id = ${eventId}
      AND EXISTS (SELECT 1 FROM events e WHERE e.id = ${eventId} AND e.is_test)
  `
  await sql`
    DELETE FROM crowd_noise_measurements WHERE event_id = ${eventId}
      AND EXISTS (SELECT 1 FROM events e WHERE e.id = ${eventId} AND e.is_test)
  `
  await sql`
    DELETE FROM event_status_log WHERE event_id = ${eventId}
      AND EXISTS (SELECT 1 FROM events e WHERE e.id = ${eventId} AND e.is_test)
  `
  return true
}

/**
 * Add made-up crowd votes to the rehearsal event while its voting is open.
 *
 * About a quarter reuse an earlier simulated phone's fingerprint and are held
 * for review, as real repeats would be; most of those also share its IP
 * address, so both review suggestions show up. Does nothing for a real event
 * or when voting is not open. Returns how many were added and how many held.
 */
export async function insertSimulatedCrowdVotes(
  eventId: string,
  bandIds: string[],
  count: number
): Promise<{ added: number; held: number }> {
  if (bandIds.length === 0 || count <= 0) return { added: 0, held: 0 }

  // Earlier simulated phones in this event, so repeats have something to match.
  const { rows: existing } = await sql<{
    fingerprintjs_visitor_id: string
    ip_address: string
  }>`
    SELECT fingerprintjs_visitor_id, host(ip_address) AS ip_address
    FROM votes
    WHERE event_id = ${eventId} AND voter_type = 'crowd'
      AND fingerprintjs_visitor_id LIKE 'sim-%'
  `
  const phones = existing.map((r) => ({
    device: r.fingerprintjs_visitor_id,
    ip: r.ip_address,
  }))

  // Skewed weights so the rehearsal has a clear crowd favourite.
  const weights = bandIds.map((_, i) => bandIds.length - i + 1)
  const weightTotal = weights.reduce((a, b) => a + b, 0)
  const pickBand = () => {
    let roll = Math.random() * weightTotal
    for (let i = 0; i < bandIds.length; i++) {
      roll -= weights[i]
      if (roll < 0) return bandIds[i]
    }
    return bandIds[bandIds.length - 1]
  }
  // TEST-NET-3 (RFC 5737): documentation addresses, never a real voter's.
  const randomIp = () => `203.0.113.${1 + Math.floor(Math.random() * 254)}`

  let added = 0
  let held = 0
  for (let i = 0; i < count; i++) {
    // Half the repeats come from the very first phone, so it ends up with
    // several votes on one connection (a "same phone again" suggestion); the
    // rest are scattered twins (a "different person" suggestion).
    const repeat = phones.length > 0 && Math.random() < 0.25
    const earlier = repeat
      ? phones[
          Math.random() < 0.5 ? 0 : Math.floor(Math.random() * phones.length)
        ]
      : null
    const device = earlier?.device ?? `sim-${randomBytes(8).toString('hex')}`
    const ip = earlier && Math.random() < 0.7 ? earlier.ip : randomIp()
    const status: VoteStatus = earlier ? 'pending' : 'approved'

    const { rowCount } = await sql`
      INSERT INTO votes (
        event_id, band_id, voter_type, crowd_vote, status,
        vote_fingerprint, fingerprintjs_visitor_id, ip_address, user_agent,
        browser_name, os_name, os_version, device_type, screen_resolution
      )
      SELECT
        ${eventId}, ${pickBand()}, 'crowd', 20, ${status},
        ${randomBytes(32).toString('hex')}, ${device}, ${ip}::inet,
        'BOTTB rehearsal simulator', 'Safari', 'iOS', '18.6', 'Mobile', '390x844'
      WHERE EXISTS (
        SELECT 1 FROM events e
        WHERE e.id = ${eventId} AND e.is_test AND e.status = 'voting'
      )
    `
    if (rowCount) {
      added++
      if (status === 'pending') held++
      if (!earlier) phones.push({ device, ip })
    }
  }
  return { added, held }
}
