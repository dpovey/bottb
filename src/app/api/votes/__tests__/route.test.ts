// @vitest-environment node

/**
 * Behaviour of POST /api/votes, the public crowd-vote endpoint: what it
 * accepts, what it stores, and how it treats returning and repeat voters.
 *
 * The response body shape lives in response-format.test.ts and the rate limit
 * in route-protected.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Use the real NextRequest/NextResponse (the setup file swaps in stubs without
// cookies) so the vote cookie is read and written exactly as in production.
vi.mock('next/server', async (importOriginal) => importOriginal())
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  getEventById: vi.fn(),
  submitVote: vi.fn(),
  updateCrowdVoteChoice: vi.fn(),
  hasUserVotedByEmail: vi.fn(),
}))
vi.mock('@/lib/sql', () => ({ sql: vi.fn(), sqlQuery: vi.fn() }))
// Real request parsing (IP, user agent, headers, UTM, vote fingerprint); only
// the database look-ups are replaced.
vi.mock('@/lib/user-context-server', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/user-context-server')>()
  return {
    ...actual,
    extractUserContext: vi.fn(actual.extractUserContext),
    hasUserVoted: vi.fn(),
    hasUserVotedByFingerprintJS: vi.fn(),
  }
})

import { POST } from '../route'
import {
  getEventById,
  hasUserVotedByEmail,
  submitVote,
  updateCrowdVoteChoice,
} from '@/lib/db'
import { sql } from '@/lib/sql'
import {
  extractUserContext,
  hasUserVoted,
  hasUserVotedByFingerprintJS,
} from '@/lib/user-context-server'
import { clearRateLimitStore } from '@/lib/api-protection'
import type { Event, Vote } from '@/lib/db-types'
import {
  BAND_ID,
  EVENT_ID,
  NEW_VOTE_ID,
  OTHER_BAND_ID,
  NO_EVENT,
  NO_VOTE,
  VOTE_ID,
  bandLookup,
  storedVote,
  voteRequest,
  votedCookie,
  votingEvent,
} from './vote-request'

const mockGetEventById = vi.mocked(getEventById)
const mockSubmitVote = vi.mocked(submitVote)
const mockUpdateChoice = vi.mocked(updateCrowdVoteChoice)
const mockVotedByEmail = vi.mocked(hasUserVotedByEmail)
const mockVotedByFingerprint = vi.mocked(hasUserVoted)
const mockVotedByVisitorId = vi.mocked(hasUserVotedByFingerprintJS)
const mockSql = vi.mocked(sql)

function asEvent(status: string) {
  return votingEvent(status) as unknown as Event
}

function asVote(overrides: Record<string, unknown> = {}) {
  return storedVote(overrides) as unknown as Vote
}

/** The single object `submitVote` was called with. */
function submitted(): Record<string, unknown> {
  expect(mockSubmitVote).toHaveBeenCalledTimes(1)
  return mockSubmitVote.mock.calls[0][0] as unknown as Record<string, unknown>
}

const uniqueViolation = () =>
  Object.assign(new Error('duplicate key value'), { code: '23505' })

/** The vote fingerprint the route worked out for this request. */
function requestFingerprint(): string {
  return mockVotedByFingerprint.mock.calls[0][1]
}

function cookieVoteId(response: Response & { cookies?: unknown }) {
  const raw = (
    response as unknown as {
      cookies: { get(name: string): { value: string } | undefined }
    }
  ).cookies.get(`voted_${EVENT_ID}`)?.value
  return raw ? (JSON.parse(raw) as { voteId?: string }).voteId : undefined
}

beforeEach(() => {
  vi.clearAllMocks()
  clearRateLimitStore()
  mockGetEventById.mockResolvedValue(asEvent('voting'))
  mockSql.mockImplementation(bandLookup() as unknown as typeof sql)
  mockSubmitVote.mockImplementation(async (vote) =>
    asVote({
      id: vote.id ?? NEW_VOTE_ID,
      band_id: vote.band_id,
      status: vote.status ?? 'approved',
    })
  )
  mockUpdateChoice.mockResolvedValue(NO_VOTE)
  mockVotedByEmail.mockResolvedValue(false)
  mockVotedByFingerprint.mockResolvedValue(false)
  mockVotedByVisitorId.mockResolvedValue(false)
})

describe('POST /api/votes', () => {
  describe('what gets stored', () => {
    it('records a crowd vote for the chosen band and counts it straight away', async () => {
      const response = await POST(voteRequest())

      expect(response.status).toBe(200)
      expect(submitted()).toMatchObject({
        event_id: EVENT_ID,
        band_id: BAND_ID,
        voter_type: 'crowd',
        crowd_vote: 20,
        status: 'approved',
      })
    })

    it('stores a crowd vote with no judge scores when the body claims to be a judge', async () => {
      const response = await POST(
        voteRequest({
          event_id: EVENT_ID,
          band_id: BAND_ID,
          voter_type: 'judge',
          name: 'Sneaky Judge',
          song_choice: 20,
          performance: 20,
          crowd_vibe: 20,
          visuals: 20,
          crowd_vote: 999,
          status: 'approved',
        })
      )

      expect(response.status).toBe(200)
      const vote = submitted()
      expect(vote.voter_type).toBe('crowd')
      expect(vote.crowd_vote).toBe(20)
      expect(vote.song_choice).toBeUndefined()
      expect(vote.performance).toBeUndefined()
      expect(vote.crowd_vibe).toBeUndefined()
      expect(vote.visuals).toBeUndefined()
      expect(vote.name).toBeUndefined()
      const body = await response.json()
      expect(body.voter_type).toBe('crowd')
    })

    it('cannot be told to store a vote as already approved when it is a repeat', async () => {
      mockVotedByEmail.mockResolvedValue(true)

      await POST(
        voteRequest({
          event_id: EVENT_ID,
          band_id: BAND_ID,
          email: 'fan@example.com',
          status: 'approved',
        })
      )

      expect(submitted().status).toBe('pending')
    })
  })

  describe('validation', () => {
    it.each([
      ['event_id is missing', { band_id: BAND_ID }],
      ['band_id is missing', { event_id: EVENT_ID }],
      ['event_id is blank', { event_id: '   ', band_id: BAND_ID }],
      ['band_id is not a string', { event_id: EVENT_ID, band_id: 42 }],
    ])('returns 400 when %s', async (_case, body) => {
      const response = await POST(voteRequest(body))

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'event_id and band_id are required',
      })
      expect(mockGetEventById).not.toHaveBeenCalled()
      expect(mockSubmitVote).not.toHaveBeenCalled()
    })

    it('returns 400 when the body is not JSON', async () => {
      const response = await POST(voteRequest({}, { rawBody: 'band=1' }))

      expect(response.status).toBe(400)
      expect(mockSubmitVote).not.toHaveBeenCalled()
    })

    it('returns 400 for a band that is not part of the event', async () => {
      mockSql.mockImplementation(
        bandLookup({
          [EVENT_ID]: [BAND_ID],
          'other-event': [OTHER_BAND_ID],
        }) as unknown as typeof sql
      )

      const response = await POST(
        voteRequest({ event_id: EVENT_ID, band_id: OTHER_BAND_ID })
      )

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'That band is not part of this event',
      })
      expect(mockSubmitVote).not.toHaveBeenCalled()
      expect(mockUpdateChoice).not.toHaveBeenCalled()
    })

    it('looks the band up within the event being voted on', async () => {
      await POST(voteRequest())

      const [, ...values] = mockSql.mock.calls[0]
      expect(values).toEqual([BAND_ID, EVENT_ID])
    })

    it('returns 404 for an unknown event', async () => {
      mockGetEventById.mockResolvedValue(NO_EVENT)

      const response = await POST(
        voteRequest({ event_id: 'no-such-event', band_id: BAND_ID })
      )

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'Event not found' })
      expect(mockGetEventById).toHaveBeenCalledWith('no-such-event')
      expect(mockSubmitVote).not.toHaveBeenCalled()
    })
  })

  describe('event status', () => {
    it.each(['upcoming', 'closed', 'locked', 'finalized'])(
      'returns 403 while the event is %s',
      async (status) => {
        mockGetEventById.mockResolvedValue(asEvent(status))

        const response = await POST(voteRequest())

        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({
          error: 'Voting is not currently open for this event',
          eventStatus: status,
        })
        expect(mockSubmitVote).not.toHaveBeenCalled()
        expect(mockUpdateChoice).not.toHaveBeenCalled()
      }
    )

    it('returns 403 for a status it does not recognise', async () => {
      mockGetEventById.mockResolvedValue(asEvent('archived'))

      const response = await POST(voteRequest())

      expect(response.status).toBe(403)
      expect(mockSubmitVote).not.toHaveBeenCalled()
    })

    it('refuses a returning voter changing their vote once voting has closed', async () => {
      mockGetEventById.mockResolvedValue(asEvent('closed'))

      const response = await POST(
        voteRequest(
          { event_id: EVENT_ID, band_id: OTHER_BAND_ID },
          { cookie: votedCookie({ bandId: BAND_ID, voteId: VOTE_ID }) }
        )
      )

      expect(response.status).toBe(403)
      expect(mockUpdateChoice).not.toHaveBeenCalled()
    })

    it('accepts votes while the event is voting', async () => {
      const response = await POST(voteRequest())

      expect(response.status).toBe(200)
      expect(mockSubmitVote).toHaveBeenCalledTimes(1)
    })
  })

  describe('returning voter (vote cookie)', () => {
    it('changes only the vote the cookie points at', async () => {
      mockUpdateChoice.mockResolvedValue(
        asVote({ id: VOTE_ID, band_id: OTHER_BAND_ID, status: 'approved' })
      )

      const response = await POST(
        voteRequest(
          { event_id: EVENT_ID, band_id: OTHER_BAND_ID },
          {
            cookie: votedCookie({
              bandId: BAND_ID,
              bandName: 'The Compilers',
              voteId: VOTE_ID,
            }),
          }
        )
      )

      expect(response.status).toBe(200)
      expect(mockUpdateChoice).toHaveBeenCalledTimes(1)
      expect(mockUpdateChoice).toHaveBeenCalledWith({
        voteId: VOTE_ID,
        eventId: EVENT_ID,
        bandId: OTHER_BAND_ID,
        email: undefined,
      })
      expect(mockSubmitVote).not.toHaveBeenCalled()
      const body = await response.json()
      expect(body).toMatchObject({
        id: VOTE_ID,
        band_id: OTHER_BAND_ID,
        status: 'approved',
        message: 'Vote updated',
        duplicateDetected: false,
      })
    })

    it('is not blocked by the repeat-vote checks when changing its own vote', async () => {
      mockVotedByFingerprint.mockResolvedValue(true)
      mockVotedByVisitorId.mockResolvedValue(true)
      mockUpdateChoice.mockResolvedValue(
        asVote({ id: VOTE_ID, band_id: OTHER_BAND_ID })
      )

      const response = await POST(
        voteRequest(
          {
            event_id: EVENT_ID,
            band_id: OTHER_BAND_ID,
            fingerprintjs_visitor_id: 'visitor-1',
          },
          { cookie: votedCookie({ bandId: BAND_ID, voteId: VOTE_ID }) }
        )
      )

      expect(response.status).toBe(200)
      expect(mockSubmitVote).not.toHaveBeenCalled()
    })

    it('passes a newly supplied email along with the change', async () => {
      mockUpdateChoice.mockResolvedValue(asVote({ id: VOTE_ID }))

      await POST(
        voteRequest(
          { event_id: EVENT_ID, band_id: BAND_ID, email: 'fan@example.com' },
          { cookie: votedCookie({ bandId: BAND_ID, voteId: VOTE_ID }) }
        )
      )

      expect(mockUpdateChoice).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'fan@example.com' })
      )
    })

    it('keeps a held vote held when it is changed', async () => {
      mockUpdateChoice.mockResolvedValue(
        asVote({ id: VOTE_ID, band_id: OTHER_BAND_ID, status: 'pending' })
      )

      const response = await POST(
        voteRequest(
          { event_id: EVENT_ID, band_id: OTHER_BAND_ID },
          { cookie: votedCookie({ bandId: BAND_ID, voteId: VOTE_ID }) }
        )
      )

      expect(response.status).toBe(201)
      expect(await response.json()).toMatchObject({
        id: VOTE_ID,
        status: 'pending',
        duplicateDetected: true,
      })
    })

    it('reads a cookie that was not URL-encoded', async () => {
      mockUpdateChoice.mockResolvedValue(asVote({ id: VOTE_ID }))

      await POST(
        voteRequest(
          { event_id: EVENT_ID, band_id: OTHER_BAND_ID },
          {
            cookie: `voted_${EVENT_ID}=${JSON.stringify({ voteId: VOTE_ID })}`,
          }
        )
      )

      expect(mockUpdateChoice).toHaveBeenCalledWith(
        expect.objectContaining({ voteId: VOTE_ID })
      )
    })

    it('records a new vote when the vote the cookie points at no longer exists', async () => {
      mockUpdateChoice.mockResolvedValue(NO_VOTE)

      const response = await POST(
        voteRequest(
          { event_id: EVENT_ID, band_id: OTHER_BAND_ID },
          { cookie: votedCookie({ bandId: BAND_ID, voteId: VOTE_ID }) }
        )
      )

      expect(mockUpdateChoice).toHaveBeenCalledTimes(1)
      expect(response.status).toBe(200)
      expect(submitted()).toMatchObject({
        band_id: OTHER_BAND_ID,
        status: 'approved',
      })
      expect(cookieVoteId(response)).toBe(NEW_VOTE_ID)
    })

    it('still applies the repeat checks when falling through to a new vote', async () => {
      mockUpdateChoice.mockResolvedValue(NO_VOTE)
      mockVotedByFingerprint.mockResolvedValue(true)

      const response = await POST(
        voteRequest(
          { event_id: EVENT_ID, band_id: OTHER_BAND_ID },
          { cookie: votedCookie({ bandId: BAND_ID, voteId: VOTE_ID }) }
        )
      )

      expect(response.status).toBe(201)
      expect(submitted()).toMatchObject({
        band_id: OTHER_BAND_ID,
        status: 'pending',
      })
    })

    it('does not promise a check when the changed vote was rejected', async () => {
      mockUpdateChoice.mockResolvedValue(
        asVote({ id: VOTE_ID, band_id: OTHER_BAND_ID, status: 'rejected' })
      )

      const response = await POST(
        voteRequest(
          { event_id: EVENT_ID, band_id: OTHER_BAND_ID },
          { cookie: votedCookie({ bandId: BAND_ID, voteId: VOTE_ID }) }
        )
      )

      // Not told it was rejected, and not told it will be checked either.
      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body).toMatchObject({
        id: VOTE_ID,
        status: 'pending',
        message: 'Vote updated',
      })
      expect(body.message).not.toMatch(/checked/)
      expect(mockSubmitVote).not.toHaveBeenCalled()
    })

    it('treats a legacy cookie without a vote id as a new vote', async () => {
      const response = await POST(
        voteRequest(
          { event_id: EVENT_ID, band_id: OTHER_BAND_ID },
          {
            cookie: votedCookie({
              bandId: BAND_ID,
              bandName: 'The Compilers',
            }),
          }
        )
      )

      expect(mockUpdateChoice).not.toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(submitted().band_id).toBe(OTHER_BAND_ID)
    })

    it.each([
      ['a vote id that is not a UUID', votedCookie({ voteId: "1' OR 1=1" })],
      ['a cookie that is not JSON', `voted_${EVENT_ID}=true`],
      [
        "another event's cookie",
        `voted_other-event=${encodeURIComponent(JSON.stringify({ voteId: VOTE_ID }))}`,
      ],
    ])('ignores %s', async (_case, cookie) => {
      const response = await POST(voteRequest(undefined, { cookie }))

      expect(mockUpdateChoice).not.toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(mockSubmitVote).toHaveBeenCalledTimes(1)
    })
  })

  describe('repeat votes', () => {
    // An identical phone on the same connection (venue Wi-Fi) produces the
    // same vote fingerprint, so a match is usually a different person.
    it('holds a vote from an identical phone on the same connection, and answers 201', async () => {
      mockVotedByFingerprint.mockResolvedValue(true)

      const response = await POST(voteRequest())

      expect(response.status).toBe(201)
      expect(submitted().status).toBe('pending')
      expect(await response.json()).toMatchObject({
        id: NEW_VOTE_ID,
        status: 'pending',
        duplicateDetected: true,
        message:
          'Your vote has been recorded and will be checked before it is counted.',
      })
      expect(cookieVoteId(response)).toBe(NEW_VOTE_ID)
    })

    it('gives each held same-connection vote a fingerprint of its own', async () => {
      mockVotedByFingerprint.mockResolvedValue(true)

      await POST(voteRequest())
      await POST(voteRequest())

      const original = requestFingerprint()
      expect(mockVotedByFingerprint.mock.calls[1][1]).toBe(original)
      const [first, second] = mockSubmitVote.mock.calls.map(
        ([vote]) => vote.vote_fingerprint
      )
      expect(first).toMatch(/^[0-9a-f]{64}$/)
      expect(second).toMatch(/^[0-9a-f]{64}$/)
      expect(first).not.toBe(original)
      expect(second).not.toBe(original)
      expect(first).not.toBe(second)
    })

    it('keeps the request fingerprint and counts a vote that is not a repeat', async () => {
      const response = await POST(voteRequest())

      expect(response.status).toBe(200)
      expect(submitted()).toMatchObject({
        status: 'approved',
        vote_fingerprint: requestFingerprint(),
      })
    })

    it('still holds an email repeat on a fresh connection under its own fingerprint', async () => {
      mockVotedByEmail.mockResolvedValue(true)

      await POST(
        voteRequest({
          event_id: EVENT_ID,
          band_id: BAND_ID,
          email: 'fan@example.com',
        })
      )

      // Only a same-connection match needs a new fingerprint.
      expect(submitted()).toMatchObject({
        status: 'pending',
        vote_fingerprint: requestFingerprint(),
      })
    })

    it('checks the device fingerprint for this event', async () => {
      await POST(voteRequest())

      expect(mockVotedByFingerprint).toHaveBeenCalledWith(
        EVENT_ID,
        expect.stringMatching(/^[0-9a-f]{64}$/)
      )
    })

    it('holds a vote from an email that has already voted, and answers 201', async () => {
      mockVotedByEmail.mockResolvedValue(true)

      const response = await POST(
        voteRequest({
          event_id: EVENT_ID,
          band_id: BAND_ID,
          email: 'fan@example.com',
        })
      )

      expect(response.status).toBe(201)
      expect(mockVotedByEmail).toHaveBeenCalledWith(EVENT_ID, 'fan@example.com')
      expect(submitted()).toMatchObject({
        status: 'pending',
        email: 'fan@example.com',
      })
      expect(await response.json()).toMatchObject({
        status: 'pending',
        duplicateDetected: true,
      })
    })

    it('holds a vote from a browser that has already voted elsewhere, and answers 201 without asking for an email', async () => {
      mockVotedByVisitorId.mockResolvedValue(true)

      const response = await POST(
        voteRequest({
          event_id: EVENT_ID,
          band_id: BAND_ID,
          fingerprintjs_visitor_id: 'visitor-1',
        })
      )

      expect(response.status).toBe(201)
      expect(mockVotedByVisitorId).toHaveBeenCalledWith(EVENT_ID, 'visitor-1')
      expect(submitted()).toMatchObject({
        status: 'pending',
        fingerprintjs_visitor_id: 'visitor-1',
      })
      const body = await response.json()
      expect(body.status).toBe('pending')
      expect(body.message).not.toMatch(/email/i)
    })

    it('treats the same email typed in a different case as the same person', async () => {
      await POST(
        voteRequest({
          event_id: EVENT_ID,
          band_id: BAND_ID,
          email: '  Fan@Example.COM ',
        })
      )

      expect(mockVotedByEmail).toHaveBeenCalledWith(EVENT_ID, 'fan@example.com')
      expect(submitted().email).toBe('fan@example.com')
    })

    it('does not treat a value without an @ as an email', async () => {
      const response = await POST(
        voteRequest({ event_id: EVENT_ID, band_id: BAND_ID, email: 'nope' })
      )

      expect(response.status).toBe(200)
      expect(mockVotedByEmail).not.toHaveBeenCalled()
      expect(submitted().email).toBeUndefined()
    })

    it('holds the second of two identical phones voting at the same instant', async () => {
      mockSubmitVote
        .mockRejectedValueOnce(uniqueViolation())
        .mockImplementationOnce(async (vote) =>
          asVote({ status: vote.status ?? 'approved' })
        )

      const response = await POST(voteRequest())

      expect(response.status).toBe(201)
      expect(await response.json()).toMatchObject({
        id: NEW_VOTE_ID,
        status: 'pending',
        duplicateDetected: true,
      })
      expect(mockSubmitVote).toHaveBeenCalledTimes(2)
      const [[firstTry], [retry]] = mockSubmitVote.mock.calls
      expect(firstTry).toMatchObject({
        status: 'approved',
        vote_fingerprint: requestFingerprint(),
      })
      expect(retry.status).toBe('pending')
      expect(retry.vote_fingerprint).toMatch(/^[0-9a-f]{64}$/)
      expect(retry.vote_fingerprint).not.toBe(requestFingerprint())
      expect(retry.band_id).toBe(BAND_ID)
      expect(cookieVoteId(response)).toBe(NEW_VOTE_ID)
    })

    it('returns 409 when the held retry also collides', async () => {
      mockSubmitVote.mockRejectedValue(uniqueViolation())

      const response = await POST(voteRequest())

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        error: 'You have already voted for this event',
        duplicateDetected: true,
      })
      expect(mockSubmitVote).toHaveBeenCalledTimes(2)
      expect(response.headers.get('set-cookie')).toBeNull()
    })

    it('returns 500 when the held retry fails some other way', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockSubmitVote
        .mockRejectedValueOnce(uniqueViolation())
        .mockRejectedValueOnce(new Error('connection reset'))

      const response = await POST(voteRequest())

      expect(response.status).toBe(500)
      consoleSpy.mockRestore()
    })

    it('does not retry a duplicate-key failure when there is no fingerprint', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const actual = await vi.importActual<
        typeof import('@/lib/user-context-server')
      >('@/lib/user-context-server')
      vi.mocked(extractUserContext).mockImplementationOnce((request, id) => ({
        ...actual.extractUserContext(request, id),
        vote_fingerprint: undefined,
      }))
      mockSubmitVote.mockRejectedValue(uniqueViolation())

      const response = await POST(voteRequest())

      expect(response.status).toBe(500)
      expect(mockSubmitVote).toHaveBeenCalledTimes(1)
      expect(mockVotedByFingerprint).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('returns 500 for any other database failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockSubmitVote.mockRejectedValue(new Error('connection reset'))

      const response = await POST(voteRequest())

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Failed to submit vote' })
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error submitting vote:',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })

    it('returns 500 when changing a vote fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockUpdateChoice.mockRejectedValue(new Error('connection reset'))

      const response = await POST(
        voteRequest(undefined, {
          cookie: votedCookie({ voteId: VOTE_ID }),
        })
      )

      expect(response.status).toBe(500)
      expect(mockSubmitVote).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('client-supplied data', () => {
    it('clips over-long strings to their column widths', async () => {
      await POST(
        voteRequest(
          {
            event_id: EVENT_ID,
            band_id: BAND_ID,
            fingerprintjs_visitor_id: 'v'.repeat(300),
            fingerprintjs_confidence_comment: 'c'.repeat(1500),
          },
          {
            headers: {
              'x-screen-resolution': '1'.repeat(40),
              'x-timezone': 'T'.repeat(80),
              'accept-language': 'en-AU-x-very-long-tag,en;q=0.9',
            },
            query: `utm_source=${'s'.repeat(150)}&utm_campaign=sydney`,
          }
        )
      )

      const vote = submitted()
      expect(vote.screen_resolution).toBe('1'.repeat(20))
      expect(vote.timezone).toBe('T'.repeat(50))
      expect(vote.language).toBe('en-AU-x-ve')
      expect(vote.utm_source).toBe('s'.repeat(100))
      expect(vote.utm_campaign).toBe('sydney')
      expect(vote.fingerprintjs_visitor_id).toBe('v'.repeat(255))
      expect(vote.fingerprintjs_confidence_comment).toBe('c'.repeat(1000))
    })

    it('clips an over-long email to the column width', async () => {
      const email = `fan@${'x'.repeat(300)}.com`

      await POST(voteRequest({ event_id: EVENT_ID, band_id: BAND_ID, email }))

      expect(submitted().email).toBe(email.slice(0, 255))
    })

    it('drops an email whose @ falls beyond the column width', async () => {
      const email = `${'a'.repeat(300)}@example.com`

      const response = await POST(
        voteRequest({ event_id: EVENT_ID, band_id: BAND_ID, email })
      )

      expect(response.status).toBe(200)
      expect(mockVotedByEmail).not.toHaveBeenCalled()
      expect(submitted().email).toBeUndefined()
    })

    it('stores a valid IP address', async () => {
      await POST(voteRequest())

      expect(submitted().ip_address).toBe('203.0.113.7')
    })

    it('drops an IP address that is not one', async () => {
      await POST(
        voteRequest(undefined, {
          headers: { 'x-forwarded-for': 'not-an-ip, 10.0.0.1' },
        })
      )

      expect(submitted().ip_address).toBeUndefined()
    })

    it.each([
      [0.95, 0.95],
      [0, 0],
      [1, 1],
      [1.5, undefined],
      [-0.1, undefined],
      ['very', undefined],
    ])(
      'stores fingerprint confidence %s as %s',
      async (confidence, expected) => {
        await POST(
          voteRequest({
            event_id: EVENT_ID,
            band_id: BAND_ID,
            fingerprintjs_confidence: confidence,
          })
        )

        expect(submitted().fingerprintjs_confidence).toBe(expected)
      }
    )
  })

  describe("the page's own vote id (client_vote_id)", () => {
    const CLIENT_ID = '0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e'

    /** A tiny stand-in for the votes table, keyed by vote id. */
    function fakeVotesTable() {
      const rows = new Map<string, Record<string, unknown>>()
      mockSubmitVote.mockImplementation(async (vote) => {
        const id = vote.id ?? NEW_VOTE_ID
        if (rows.has(id)) throw uniqueViolation()
        const row = { ...vote, id, status: vote.status ?? 'approved' }
        rows.set(id, row)
        return asVote(row)
      })
      mockUpdateChoice.mockImplementation(
        async ({ voteId, eventId, bandId }) => {
          const row = rows.get(voteId)
          if (!row || row.event_id !== eventId) return NO_VOTE
          row.band_id = bandId
          return asVote(row)
        }
      )
      return rows
    }

    it('recognises a vote re-sent after its answer was lost, instead of storing it twice', async () => {
      const rows = fakeVotesTable()

      // First attempt: saved, but the phone never gets the answer or cookie.
      const first = await POST(
        voteRequest({
          event_id: EVENT_ID,
          band_id: BAND_ID,
          client_vote_id: CLIENT_ID,
        })
      )
      expect(first.status).toBe(200)
      expect(rows.size).toBe(1)
      // The same phone and connection: the fingerprint would now match.
      mockVotedByFingerprint.mockResolvedValue(true)

      // The voter taps again, with no cookie.
      const second = await POST(
        voteRequest({
          event_id: EVENT_ID,
          band_id: OTHER_BAND_ID,
          client_vote_id: CLIENT_ID,
        })
      )

      expect(second.status).toBe(200)
      expect(mockSubmitVote).toHaveBeenCalledTimes(1)
      expect(mockSubmitVote.mock.calls[0][0].id).toBe(CLIENT_ID)
      expect(mockUpdateChoice).toHaveBeenLastCalledWith({
        voteId: CLIENT_ID,
        eventId: EVENT_ID,
        bandId: OTHER_BAND_ID,
        email: undefined,
      })
      expect(rows.size).toBe(1)
      expect(rows.get(CLIENT_ID)?.band_id).toBe(OTHER_BAND_ID)
      expect(await second.json()).toMatchObject({
        id: CLIENT_ID,
        band_id: OTHER_BAND_ID,
        status: 'approved',
        message: 'Vote updated',
      })
      expect(cookieVoteId(second)).toBe(CLIENT_ID)
    })

    it('tries the vote only once when the cookie and the page agree on its id', async () => {
      mockUpdateChoice.mockResolvedValue(asVote({ id: CLIENT_ID }))

      const response = await POST(
        voteRequest(
          { event_id: EVENT_ID, band_id: BAND_ID, client_vote_id: CLIENT_ID },
          { cookie: votedCookie({ voteId: CLIENT_ID }) }
        )
      )

      expect(response.status).toBe(200)
      expect(mockUpdateChoice).toHaveBeenCalledTimes(1)
      expect(mockSubmitVote).not.toHaveBeenCalled()
    })

    it("uses the cookie's vote first when both exist", async () => {
      mockUpdateChoice.mockResolvedValue(asVote({ id: VOTE_ID }))

      const response = await POST(
        voteRequest(
          { event_id: EVENT_ID, band_id: BAND_ID, client_vote_id: CLIENT_ID },
          { cookie: votedCookie({ voteId: VOTE_ID }) }
        )
      )

      expect(mockUpdateChoice).toHaveBeenCalledTimes(1)
      expect(mockUpdateChoice.mock.calls[0][0].voteId).toBe(VOTE_ID)
      expect(cookieVoteId(response)).toBe(VOTE_ID)
    })

    it("changes the page's vote when the cookie points at a vote that is gone", async () => {
      mockUpdateChoice.mockImplementation(async ({ voteId }) =>
        voteId === CLIENT_ID
          ? asVote({ id: CLIENT_ID, band_id: OTHER_BAND_ID })
          : NO_VOTE
      )

      const response = await POST(
        voteRequest(
          {
            event_id: EVENT_ID,
            band_id: OTHER_BAND_ID,
            client_vote_id: CLIENT_ID,
          },
          { cookie: votedCookie({ voteId: VOTE_ID }) }
        )
      )

      expect(mockUpdateChoice.mock.calls.map(([u]) => u.voteId)).toEqual([
        VOTE_ID,
        CLIENT_ID,
      ])
      expect(mockSubmitVote).not.toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect((await response.json()).id).toBe(CLIENT_ID)
      expect(cookieVoteId(response)).toBe(CLIENT_ID)
    })

    it("stores a new vote under the page's id when neither vote exists", async () => {
      const response = await POST(
        voteRequest(
          { event_id: EVENT_ID, band_id: BAND_ID, client_vote_id: CLIENT_ID },
          { cookie: votedCookie({ voteId: VOTE_ID }) }
        )
      )

      expect(mockUpdateChoice).toHaveBeenCalledTimes(2)
      expect(submitted()).toMatchObject({ id: CLIENT_ID, status: 'approved' })
      expect(response.status).toBe(200)
      expect(cookieVoteId(response)).toBe(CLIENT_ID)
    })

    it.each([
      ['not a UUID', 'vote-1'],
      ['a number', 42],
      ['SQL', "x' OR '1'='1"],
    ])('ignores a client_vote_id that is %s', async (_case, clientVoteId) => {
      const response = await POST(
        voteRequest({
          event_id: EVENT_ID,
          band_id: BAND_ID,
          client_vote_id: clientVoteId,
        })
      )

      expect(response.status).toBe(200)
      expect(mockUpdateChoice).not.toHaveBeenCalled()
      expect(submitted().id).toBeUndefined()
    })

    it('answers a vote sent twice at once as a change of the first', async () => {
      // Both requests found no vote; the other one's insert got there first.
      mockUpdateChoice
        .mockResolvedValueOnce(NO_VOTE)
        .mockResolvedValueOnce(asVote({ id: CLIENT_ID }))
      mockSubmitVote.mockRejectedValue(uniqueViolation())

      const response = await POST(
        voteRequest({
          event_id: EVENT_ID,
          band_id: BAND_ID,
          client_vote_id: CLIENT_ID,
        })
      )

      expect(response.status).toBe(200)
      expect(mockSubmitVote).toHaveBeenCalledTimes(1)
      expect(mockUpdateChoice).toHaveBeenCalledTimes(2)
      expect(mockUpdateChoice.mock.calls[1][0].voteId).toBe(CLIENT_ID)
      expect(await response.json()).toMatchObject({
        id: CLIENT_ID,
        message: 'Vote updated',
      })
      expect(cookieVoteId(response)).toBe(CLIENT_ID)
    })

    it("holds the vote under a new id when the collision was not the page's own vote", async () => {
      mockSubmitVote
        .mockRejectedValueOnce(uniqueViolation())
        .mockImplementationOnce(async (vote) =>
          asVote({ id: vote.id ?? NEW_VOTE_ID, status: vote.status })
        )

      const response = await POST(
        voteRequest({
          event_id: EVENT_ID,
          band_id: BAND_ID,
          client_vote_id: CLIENT_ID,
        })
      )

      expect(mockUpdateChoice).toHaveBeenCalledTimes(2)
      expect(mockSubmitVote).toHaveBeenCalledTimes(2)
      const [[firstTry], [retry]] = mockSubmitVote.mock.calls
      expect(firstTry.id).toBe(CLIENT_ID)
      expect(retry.id).toBeUndefined()
      expect(retry.status).toBe('pending')
      expect(retry.vote_fingerprint).not.toBe(firstTry.vote_fingerprint)
      expect(response.status).toBe(201)
      expect(cookieVoteId(response)).toBe(NEW_VOTE_ID)
    })
  })

  describe('vote cookie', () => {
    it('sets a cookie holding the new vote id', async () => {
      const response = await POST(voteRequest())

      expect(cookieVoteId(response)).toBe(NEW_VOTE_ID)
      expect(response.headers.get('set-cookie')).toContain(`voted_${EVENT_ID}=`)
    })

    it('sets the cookie for a held vote too', async () => {
      mockVotedByVisitorId.mockResolvedValue(true)

      const response = await POST(
        voteRequest({
          event_id: EVENT_ID,
          band_id: BAND_ID,
          fingerprintjs_visitor_id: 'visitor-1',
        })
      )

      expect(response.status).toBe(201)
      expect(cookieVoteId(response)).toBe(NEW_VOTE_ID)
    })

    it('keeps pointing at the same vote after a change', async () => {
      mockUpdateChoice.mockResolvedValue(
        asVote({ id: VOTE_ID, band_id: OTHER_BAND_ID })
      )

      const response = await POST(
        voteRequest(
          { event_id: EVENT_ID, band_id: OTHER_BAND_ID },
          { cookie: votedCookie({ bandId: BAND_ID, voteId: VOTE_ID }) }
        )
      )

      expect(cookieVoteId(response)).toBe(VOTE_ID)
    })

    it('a cookie the route set can be used to change that vote', async () => {
      const first = await POST(voteRequest())
      const setCookie = first.headers.get('set-cookie') ?? ''
      const cookie = setCookie.split(';')[0]
      mockUpdateChoice.mockResolvedValue(
        asVote({ id: NEW_VOTE_ID, band_id: OTHER_BAND_ID })
      )

      const second = await POST(
        voteRequest({ event_id: EVENT_ID, band_id: OTHER_BAND_ID }, { cookie })
      )

      expect(second.status).toBe(200)
      expect(mockUpdateChoice).toHaveBeenCalledWith(
        expect.objectContaining({ voteId: NEW_VOTE_ID, bandId: OTHER_BAND_ID })
      )
      expect(mockSubmitVote).toHaveBeenCalledTimes(1)
    })

    it('does not set a cookie when the vote is refused', async () => {
      mockGetEventById.mockResolvedValue(asEvent('closed'))

      const response = await POST(voteRequest())

      expect(response.status).toBe(403)
      expect(response.headers.get('set-cookie')).toBeNull()
    })
  })
})
