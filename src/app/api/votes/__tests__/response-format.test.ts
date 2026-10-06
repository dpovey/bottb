// @vitest-environment node

/**
 * The contract between POST /api/votes and the crowd voting page: the
 * response body for each outcome, and the `voted_<event>` cookie the page
 * reads back.
 *
 * What the route stores and when it refuses lives in route.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/server', async (importOriginal) => importOriginal())
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  getEventById: vi.fn(),
  submitVote: vi.fn(),
  updateCrowdVoteChoice: vi.fn(),
  hasUserVotedByEmail: vi.fn(),
}))
vi.mock('@/lib/sql', () => ({ sql: vi.fn(), sqlQuery: vi.fn() }))
vi.mock('@/lib/user-context-server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/user-context-server')>()),
  hasUserVoted: vi.fn(),
  hasUserVotedByFingerprintJS: vi.fn(),
}))
vi.mock('@fingerprintjs/fingerprintjs', () => ({ default: { load: vi.fn() } }))

import { POST } from '../route'
import {
  getEventById,
  hasUserVotedByEmail,
  submitVote,
  updateCrowdVoteChoice,
} from '@/lib/db'
import { sql } from '@/lib/sql'
import {
  hasUserVoted,
  hasUserVotedByFingerprintJS,
} from '@/lib/user-context-server'
import { getVoteFromCookie } from '@/lib/user-context-client'
import { clearRateLimitStore } from '@/lib/api-protection'
import type { Event, Vote } from '@/lib/db-types'
import {
  BAND_ID,
  BAND_NAMES,
  EVENT_ID,
  NEW_VOTE_ID,
  OTHER_BAND_ID,
  VOTE_ID,
  bandLookup,
  storedVote,
  voteRequest,
  votedCookie,
  votingEvent,
  NO_VOTE,
} from './vote-request'

const mockSubmitVote = vi.mocked(submitVote)
const mockUpdateChoice = vi.mocked(updateCrowdVoteChoice)

beforeEach(() => {
  vi.clearAllMocks()
  clearRateLimitStore()
  vi.mocked(getEventById).mockResolvedValue(
    votingEvent('voting') as unknown as Event
  )
  vi.mocked(sql).mockImplementation(bandLookup() as unknown as typeof sql)
  mockSubmitVote.mockImplementation(
    async (vote) =>
      storedVote({
        band_id: vote.band_id,
        status: vote.status ?? 'approved',
        email: vote.email,
      }) as unknown as Vote
  )
  mockUpdateChoice.mockResolvedValue(NO_VOTE)
  vi.mocked(hasUserVotedByEmail).mockResolvedValue(false)
  vi.mocked(hasUserVoted).mockResolvedValue(false)
  vi.mocked(hasUserVotedByFingerprintJS).mockResolvedValue(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('POST /api/votes response format', () => {
  describe('body', () => {
    it('describes a new counted vote, and nothing else about it', async () => {
      const response = await POST(voteRequest())

      expect(response.status).toBe(200)
      // Exactly these fields: none of the stored row (IP address, fingerprint,
      // email, ...) is echoed back.
      expect(await response.json()).toEqual({
        id: NEW_VOTE_ID,
        event_id: EVENT_ID,
        band_id: BAND_ID,
        voter_type: 'crowd',
        message: 'Vote submitted successfully',
        status: 'approved',
        duplicateDetected: false,
      })
    })

    it('describes a held vote', async () => {
      vi.mocked(hasUserVotedByEmail).mockResolvedValue(true)

      const response = await POST(
        voteRequest({
          event_id: EVENT_ID,
          band_id: BAND_ID,
          email: 'fan@example.com',
        })
      )

      expect(response.status).toBe(201)
      expect(await response.json()).toEqual({
        id: NEW_VOTE_ID,
        event_id: EVENT_ID,
        band_id: BAND_ID,
        voter_type: 'crowd',
        message:
          'Your vote has been recorded and will be checked before it is counted.',
        status: 'pending',
        duplicateDetected: true,
      })
    })

    it('describes a changed vote', async () => {
      mockUpdateChoice.mockResolvedValue(
        storedVote({ id: VOTE_ID, band_id: OTHER_BAND_ID }) as unknown as Vote
      )

      const response = await POST(
        voteRequest(
          { event_id: EVENT_ID, band_id: OTHER_BAND_ID },
          { cookie: votedCookie({ voteId: VOTE_ID }) }
        )
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        id: VOTE_ID,
        event_id: EVENT_ID,
        band_id: OTHER_BAND_ID,
        voter_type: 'crowd',
        message: 'Vote updated',
        status: 'approved',
        duplicateDetected: false,
      })
    })

    it('describes a changed vote that is still held', async () => {
      mockUpdateChoice.mockResolvedValue(
        storedVote({
          id: VOTE_ID,
          band_id: OTHER_BAND_ID,
          status: 'pending',
        }) as unknown as Vote
      )

      const response = await POST(
        voteRequest(
          { event_id: EVENT_ID, band_id: OTHER_BAND_ID },
          { cookie: votedCookie({ voteId: VOTE_ID }) }
        )
      )

      expect(response.status).toBe(201)
      expect(await response.json()).toEqual({
        id: VOTE_ID,
        event_id: EVENT_ID,
        band_id: OTHER_BAND_ID,
        voter_type: 'crowd',
        message:
          'Your vote has been updated and will be checked before it is counted.',
        status: 'pending',
        duplicateDetected: true,
      })
    })

    it('describes a vote from an identical phone on the same connection as held', async () => {
      vi.mocked(hasUserVoted).mockResolvedValue(true)

      const response = await POST(voteRequest())

      expect(response.status).toBe(201)
      expect(await response.json()).toEqual({
        id: NEW_VOTE_ID,
        event_id: EVENT_ID,
        band_id: BAND_ID,
        voter_type: 'crowd',
        message:
          'Your vote has been recorded and will be checked before it is counted.',
        status: 'pending',
        duplicateDetected: true,
      })
    })

    it('describes a changed rejected vote neutrally, without saying it was rejected', async () => {
      mockUpdateChoice.mockResolvedValue(
        storedVote({
          id: VOTE_ID,
          band_id: OTHER_BAND_ID,
          status: 'rejected',
        }) as unknown as Vote
      )

      const response = await POST(
        voteRequest(
          { event_id: EVENT_ID, band_id: OTHER_BAND_ID },
          { cookie: votedCookie({ voteId: VOTE_ID }) }
        )
      )

      expect(response.status).toBe(201)
      expect(await response.json()).toEqual({
        id: VOTE_ID,
        event_id: EVENT_ID,
        band_id: OTHER_BAND_ID,
        voter_type: 'crowd',
        message: 'Vote updated',
        status: 'pending',
        duplicateDetected: true,
      })
    })

    it('reports already voted, without a vote id, when the vote cannot be stored at all', async () => {
      mockSubmitVote.mockRejectedValue(
        Object.assign(new Error('duplicate key'), { code: '23505' })
      )

      const response = await POST(voteRequest())

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        error: 'You have already voted for this event',
        duplicateDetected: true,
      })
    })

    it('tells the page which status the event is in when voting is shut', async () => {
      vi.mocked(getEventById).mockResolvedValue(
        votingEvent('closed') as unknown as Event
      )

      const response = await POST(voteRequest())

      expect(response.status).toBe(403)
      expect((await response.json()).eventStatus).toBe('closed')
    })
  })

  describe('vote cookie', () => {
    it('is a 30-day, site-wide cookie the page can read', async () => {
      const response = await POST(voteRequest())

      const setCookie = response.headers.get('set-cookie') ?? ''
      expect(setCookie).toMatch(new RegExp(`^voted_${EVENT_ID}=`))
      expect(setCookie).toContain('Path=/')
      expect(setCookie).toContain(`Max-Age=${30 * 24 * 60 * 60}`)
      expect(setCookie.toLowerCase()).toContain('samesite=lax')
      expect(setCookie.toLowerCase()).not.toContain('httponly')
    })

    it('holds the band, its name from the database and the vote id', async () => {
      const response = await POST(
        voteRequest({
          event_id: EVENT_ID,
          band_id: OTHER_BAND_ID,
          bandName: 'Injected Name',
        })
      )

      const cookies = (
        response as unknown as {
          cookies: { get(name: string): { value: string } | undefined }
        }
      ).cookies
      const value = JSON.parse(cookies.get(`voted_${EVENT_ID}`)?.value ?? '{}')
      expect(value).toEqual({
        bandId: OTHER_BAND_ID,
        bandName: BAND_NAMES[OTHER_BAND_ID],
        voteId: NEW_VOTE_ID,
      })
    })

    it('is read back by the voting page as the previous vote', async () => {
      const response = await POST(voteRequest())
      const cookiePair = (response.headers.get('set-cookie') ?? '').split(
        ';'
      )[0]
      vi.stubGlobal('document', { cookie: `other=1; ${cookiePair}` })

      expect(getVoteFromCookie(EVENT_ID)).toMatchObject({
        bandId: BAND_ID,
        bandName: BAND_NAMES[BAND_ID],
      })
    })
  })
})
