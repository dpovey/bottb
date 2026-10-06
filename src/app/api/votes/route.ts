import { createHash, randomUUID } from 'crypto'
import { isIP } from 'net'
import { NextRequest, NextResponse } from 'next/server'
import {
  submitVote,
  updateCrowdVoteChoice,
  hasUserVotedByEmail,
  getEventById,
} from '@/lib/db'
import { isCompetingBand, type BandWithInfo } from '@/lib/competing-bands'
import { isUuid } from '@/lib/db/night'
import { sql } from '@/lib/sql'
import { isCrowdVotingOpen, isEventStatus } from '@/lib/event-lifecycle'
import {
  extractUserContext,
  hasUserVoted,
  hasUserVotedByFingerprintJS,
} from '@/lib/user-context-server'
import { withVoteRateLimit } from '@/lib/api-protection'

/** Trim a client-supplied string to its column width; empty becomes undefined. */
function clip(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : undefined
}

/** The id of the vote this browser cast earlier, from its `voted_<event>` cookie. */
function getCookieVoteId(request: NextRequest, eventId: string): string | null {
  const raw = request.cookies.get(`voted_${eventId}`)?.value
  if (!raw) return null
  for (const candidate of [raw, safeDecode(raw)]) {
    try {
      const parsed = JSON.parse(candidate) as { voteId?: unknown }
      if (isUuid(parsed?.voteId)) return parsed.voteId
    } catch {
      // Not JSON in this form; try the next one.
    }
  }
  return null
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === '23505'
  )
}

const ALREADY_VOTED = {
  error: 'You have already voted for this event',
  duplicateDetected: true,
}

/**
 * `votes.vote_fingerprint` is unique, so a held vote from an identical phone
 * on the same connection cannot reuse the fingerprint of the vote it matched.
 * It gets one of its own; review matches on IP address and browser instead.
 */
function heldFingerprint(fingerprint: string): string {
  return createHash('sha256')
    .update(`${fingerprint}|held|${randomUUID()}`)
    .digest('hex')
}

/**
 * POST /api/votes — submit (or change) a crowd vote. Public.
 *
 * This endpoint only ever records crowd votes: `voter_type` and any judge
 * score fields in the body are ignored. Judge sheets go through the
 * admin-only `/api/votes/batch`.
 *
 * - 200 vote recorded (or changed) and counted
 * - 201 vote recorded but held for review (looks like a repeat)
 * - 400 malformed request, or the band is not in this event
 * - 403 voting is not open
 * - 404 no such event
 *
 * A vote that looks like a repeat is never refused, because we cannot tell a
 * repeat from a different person with an identical phone (same browser, and
 * on venue Wi-Fi or a mobile carrier the same IP address too). It is held and
 * an admin decides on the "Run the night" page.
 */
async function handleVote(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const event_id = clip(body?.event_id, 255)
    const band_id = clip(body?.band_id, 255)
    if (!event_id || !band_id) {
      return NextResponse.json(
        { error: 'event_id and band_id are required' },
        { status: 400 }
      )
    }
    // Lower-cased so the same address typed two ways is still one person.
    const rawEmail = clip(body?.email, 255)
    const email = rawEmail?.includes('@') ? rawEmail.toLowerCase() : undefined

    // Validate event status before allowing votes
    const event = await getEventById(event_id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (!isEventStatus(event.status) || !isCrowdVotingOpen(event.status)) {
      return NextResponse.json(
        {
          error: 'Voting is not currently open for this event',
          eventStatus: event.status,
        },
        { status: 403 }
      )
    }

    // The band must be one of this event's, and competing: special guests
    // (non-competing bands) cannot be voted for.
    const { rows: bandRows } = await sql<{ name: string } & BandWithInfo>`
      SELECT name, info FROM bands WHERE id = ${band_id} AND event_id = ${event_id}
    `
    if (bandRows.length === 0) {
      return NextResponse.json(
        { error: 'That band is not part of this event' },
        { status: 400 }
      )
    }
    if (!isCompetingBand(bandRows[0])) {
      return NextResponse.json(
        {
          error: `${bandRows[0].name} are special guests and are not in the vote`,
        },
        { status: 400 }
      )
    }
    const bandName = bandRows[0].name

    const respond = (
      vote: { id: string; status?: string },
      message: string,
      duplicateDetected: boolean
    ) => {
      const status = vote.status === 'approved' ? 'approved' : 'pending'
      const response = NextResponse.json(
        {
          id: vote.id,
          event_id,
          band_id,
          voter_type: 'crowd',
          message,
          status,
          duplicateDetected,
        },
        { status: status === 'approved' ? 200 : 201 }
      )
      response.cookies.set(
        `voted_${event_id}`,
        JSON.stringify({ bandId: band_id, bandName, voteId: vote.id }),
        {
          maxAge: 30 * 24 * 60 * 60, // 30 days
          httpOnly: false, // Allow client-side access to read vote data
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        }
      )
      return response
    }

    // A returning voter changes their own vote; nobody else's is touched.
    // The vote is known either from the cookie, or from the id the page made
    // up and sends with every attempt. The second matters on a bad signal:
    // if the vote was saved but the answer (and its cookie) never arrived, the
    // voter taps again, and this must be the same vote, not another one.
    const clientVoteId = isUuid(body?.client_vote_id)
      ? (body.client_vote_id as string)
      : null
    const changeOwnVote = async (voteId: string) => {
      const updated = await updateCrowdVoteChoice({
        voteId,
        eventId: event_id,
        bandId: band_id,
        email,
      })
      return updated
        ? respond(
            updated,
            updated.status === 'pending'
              ? 'Your vote has been updated and will be checked before it is counted.'
              : 'Vote updated',
            updated.status !== 'approved'
          )
        : null
    }
    const cookieVoteId = getCookieVoteId(request, event_id)
    for (const voteId of new Set([cookieVoteId, clientVoteId])) {
      if (!voteId) continue
      const changed = await changeOwnVote(voteId)
      if (changed) return changed
      // No such vote (any more); treat this as a new vote.
    }

    // Extract user context from request
    const userContext = extractUserContext(request, event_id)
    if (userContext.ip_address && !isIP(userContext.ip_address)) {
      userContext.ip_address = undefined
    }
    const visitorId = clip(body?.fingerprintjs_visitor_id, 255)
    const confidence = Number(body?.fingerprintjs_confidence)

    // Looks like a repeat — an identical browser on the same IP address, the
    // same email, or the same browser fingerprint from somewhere else. Record
    // it, but hold it for an admin to decide.
    const sameConnection =
      !!userContext.vote_fingerprint &&
      (await hasUserVoted(event_id, userContext.vote_fingerprint))
    const duplicateDetected =
      sameConnection ||
      (!!email && (await hasUserVotedByEmail(event_id, email))) ||
      (!!visitorId && (await hasUserVotedByFingerprintJS(event_id, visitorId)))

    const record = (
      held: boolean,
      fingerprint: string | undefined,
      id: string | null = clientVoteId
    ) =>
      submitVote({
        id: id ?? undefined,
        event_id,
        band_id,
        voter_type: 'crowd',
        crowd_vote: 20,
        email,
        status: held ? 'pending' : 'approved',
        ip_address: userContext.ip_address,
        user_agent: userContext.user_agent,
        browser_name: clip(userContext.browser_name, 100),
        browser_version: clip(userContext.browser_version, 50),
        os_name: clip(userContext.os_name, 100),
        os_version: clip(userContext.os_version, 50),
        device_type: clip(userContext.device_type, 50),
        screen_resolution: clip(userContext.screen_resolution, 20),
        timezone: clip(userContext.timezone, 50),
        language: clip(userContext.language, 10),
        google_click_id: clip(userContext.google_click_id, 255),
        facebook_pixel_id: clip(userContext.facebook_pixel_id, 255),
        utm_source: clip(userContext.utm_source, 100),
        utm_medium: clip(userContext.utm_medium, 100),
        utm_campaign: clip(userContext.utm_campaign, 100),
        utm_term: clip(userContext.utm_term, 100),
        utm_content: clip(userContext.utm_content, 100),
        vote_fingerprint: fingerprint,
        fingerprintjs_visitor_id: visitorId,
        fingerprintjs_confidence:
          Number.isFinite(confidence) && confidence >= 0 && confidence <= 1
            ? confidence
            : undefined,
        fingerprintjs_confidence_comment: clip(
          body?.fingerprintjs_confidence_comment,
          1000
        ),
      })

    const fingerprint = userContext.vote_fingerprint
    let held = duplicateDetected
    let vote
    try {
      vote = await record(
        held,
        sameConnection && fingerprint
          ? heldFingerprint(fingerprint)
          : fingerprint
      )
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      // The page's own vote id is already there: the same vote was sent twice
      // at once (a double tap, or a retry racing the original).
      if (clientVoteId) {
        const changed = await changeOwnVote(clientVoteId)
        if (changed) return changed
      }
      if (!fingerprint) throw error
      // Otherwise two identical phones on one connection voted at the same
      // moment and the other one got there first. Keep this vote too, held,
      // under an id of the database's choosing.
      held = true
      try {
        vote = await record(true, heldFingerprint(fingerprint), null)
      } catch (retryError) {
        if (isUniqueViolation(retryError)) {
          return NextResponse.json(ALREADY_VOTED, { status: 409 })
        }
        throw retryError
      }
    }

    return respond(
      vote,
      held
        ? 'Your vote has been recorded and will be checked before it is counted.'
        : 'Vote submitted successfully',
      held
    )
  } catch (error) {
    console.error('Error submitting vote:', error)
    return NextResponse.json(
      { error: 'Failed to submit vote' },
      { status: 500 }
    )
  }
}

export const POST = withVoteRateLimit(handleVote)
