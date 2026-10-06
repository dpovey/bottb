/**
 * Shared helpers for the `/api/votes` route tests. Not a test file itself.
 *
 * The route is exercised with the real `NextRequest`/`NextResponse` (each test
 * file un-mocks `next/server`), so cookies and headers behave as they do in
 * production.
 */
import { NextRequest } from 'next/server'
import type { Event, Vote } from '@/lib/db-types'

export const EVENT_ID = 'event-1'
export const BAND_ID = 'band-1'
export const OTHER_BAND_ID = 'band-2'
/** Special guests: in the event, but flagged `info.non_competing`. */
export const GUEST_BAND_ID = 'band-guest'
export const BAND_NAMES: Record<string, string> = {
  [BAND_ID]: 'The Compilers',
  [OTHER_BAND_ID]: 'Stack Overflow',
  [GUEST_BAND_ID]: 'ShipReX',
}

/** A vote id as the database would issue it. */
export const VOTE_ID = '3f2b8c1e-7d4a-4f6b-9c2e-1a5d8e9f0b7c'
export const NEW_VOTE_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

export interface VoteRequestOptions {
  headers?: Record<string, string>
  /** Raw `Cookie` header value. */
  cookie?: string
  /** Query string appended to the URL, e.g. `utm_source=qr`. */
  query?: string
  /** Send this string as the body instead of JSON-encoding `body`. */
  rawBody?: string
}

export function voteRequest(
  body: Record<string, unknown> = { event_id: EVENT_ID, band_id: BAND_ID },
  options: VoteRequestOptions = {}
): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X)',
    'x-forwarded-for': '203.0.113.7',
    ...options.headers,
  }
  if (options.cookie) headers.cookie = options.cookie
  const url = `http://localhost/api/votes${options.query ? `?${options.query}` : ''}`
  return new NextRequest(url, {
    method: 'POST',
    headers,
    body: options.rawBody ?? JSON.stringify(body),
  })
}

/** The `voted_<event>` cookie the route sets, as the browser sends it back. */
export function votedCookie(value: Record<string, unknown>): string {
  return `voted_${EVENT_ID}=${encodeURIComponent(JSON.stringify(value))}`
}

/** A tagged-template stand-in for `sql` that knows which bands are in which event. */
export function bandLookup(
  bandsByEvent: Record<string, string[]> = {
    [EVENT_ID]: [BAND_ID, OTHER_BAND_ID],
  }
) {
  return async (_strings: TemplateStringsArray, ...values: unknown[]) => {
    const [bandId, eventId] = values as [string, string]
    const inEvent = bandsByEvent[eventId]?.includes(bandId)
    return {
      rows: inEvent
        ? [
            {
              name: BAND_NAMES[bandId] ?? bandId,
              info:
                bandId === GUEST_BAND_ID ? { non_competing: true } : undefined,
            },
          ]
        : [],
      rowCount: inEvent ? 1 : 0,
      command: 'SELECT',
      oid: 0,
      fields: [],
    }
  }
}

export function votingEvent(status = 'voting') {
  return {
    id: EVENT_ID,
    name: 'Sydney 2026',
    date: '2026-10-08T08:00:00Z',
    location: 'Factory Theatre',
    is_active: status === 'voting',
    status,
    created_at: '2026-01-01T00:00:00Z',
  }
}

/** A stored vote row, as `submitVote`/`updateCrowdVoteChoice` return it. */
export function storedVote(overrides: Record<string, unknown> = {}) {
  return {
    id: NEW_VOTE_ID,
    event_id: EVENT_ID,
    band_id: BAND_ID,
    voter_type: 'crowd' as const,
    crowd_vote: 20,
    status: 'approved' as const,
    ip_address: '203.0.113.7',
    vote_fingerprint: 'f'.repeat(64),
    email: undefined,
    created_at: '2026-10-08T10:00:00Z',
    ...overrides,
  }
}

/**
 * "Not found" for `getEventById` / `updateCrowdVoteChoice`. Both return
 * `rows[0] || null`, which TypeScript types as never null, but at runtime they
 * do return null and the route relies on it.
 */
export const NO_EVENT = null as unknown as Event
export const NO_VOTE = null as unknown as Vote
