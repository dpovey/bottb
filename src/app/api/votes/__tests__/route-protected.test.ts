// @vitest-environment node

/**
 * Rate limiting on POST /api/votes. The limit is per IP address + browser, and
 * has to leave room for a crowd voting from one venue Wi-Fi address.
 *
 * What the route stores lives in route.test.ts; the response body in
 * response-format.test.ts.
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
import { clearRateLimitStore } from '@/lib/api-protection'
import type { Event, Vote } from '@/lib/db-types'
import {
  bandLookup,
  storedVote,
  voteRequest,
  votingEvent,
  NO_VOTE,
} from './vote-request'

const VOTE_LIMIT = 300
const mockSubmitVote = vi.mocked(submitVote)

const phone = (ip: string, userAgent = 'iPhone Safari') => ({
  headers: { 'x-forwarded-for': ip, 'user-agent': userAgent },
})

async function sendVotes(
  count: number,
  ip = '203.0.113.7',
  userAgent?: string
) {
  return Promise.all(
    Array.from({ length: count }, () =>
      POST(voteRequest(undefined, phone(ip, userAgent)))
    )
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  clearRateLimitStore()
  vi.mocked(getEventById).mockResolvedValue(
    votingEvent('voting') as unknown as Event
  )
  vi.mocked(sql).mockImplementation(bandLookup() as unknown as typeof sql)
  mockSubmitVote.mockResolvedValue(storedVote() as unknown as Vote)
  vi.mocked(updateCrowdVoteChoice).mockResolvedValue(NO_VOTE)
  vi.mocked(hasUserVotedByEmail).mockResolvedValue(false)
  vi.mocked(hasUserVoted).mockResolvedValue(false)
  vi.mocked(hasUserVotedByFingerprintJS).mockResolvedValue(false)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('POST /api/votes rate limiting', () => {
  it(`lets ${VOTE_LIMIT} votes a minute through from one address and browser`, async () => {
    const responses = await sendVotes(VOTE_LIMIT)

    expect(responses.every((r) => r.status === 200)).toBe(true)
    expect(mockSubmitVote).toHaveBeenCalledTimes(VOTE_LIMIT)
  })

  it('refuses the next one with 429, and stores nothing for it', async () => {
    await sendVotes(VOTE_LIMIT)
    mockSubmitVote.mockClear()

    const response = await POST(voteRequest(undefined, phone('203.0.113.7')))

    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body).toMatchObject({
      error: 'Too many requests',
      limit: VOTE_LIMIT,
      windowMs: 60_000,
    })
    expect(body.retryAfter).toBeGreaterThan(0)
    expect(body.retryAfter).toBeLessThanOrEqual(60)
    expect(response.headers.get('Retry-After')).toBe(String(body.retryAfter))
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(mockSubmitVote).not.toHaveBeenCalled()
    expect(getEventById).toHaveBeenCalledTimes(VOTE_LIMIT)
  })

  it('counts each browser on the same address separately', async () => {
    await sendVotes(VOTE_LIMIT, '203.0.113.7', 'iPhone Safari')

    const android = await POST(
      voteRequest(undefined, phone('203.0.113.7', 'Android Chrome'))
    )

    expect(android.status).toBe(200)
  })

  it('counts each address separately', async () => {
    await sendVotes(VOTE_LIMIT, '203.0.113.7')

    const otherAddress = await POST(
      voteRequest(undefined, phone('198.51.100.20'))
    )

    expect(otherAddress.status).toBe(200)
  })

  it('lets votes through again once the minute is up', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-08T10:00:00Z'))
    await sendVotes(VOTE_LIMIT)
    expect(
      (await POST(voteRequest(undefined, phone('203.0.113.7')))).status
    ).toBe(429)

    vi.setSystemTime(new Date('2026-10-08T10:01:01Z'))

    expect(
      (await POST(voteRequest(undefined, phone('203.0.113.7')))).status
    ).toBe(200)
  })

  it('reports the limit and what is left on an accepted vote', async () => {
    const [first, second] = [
      await POST(voteRequest(undefined, phone('203.0.113.7'))),
      await POST(voteRequest(undefined, phone('203.0.113.7'))),
    ]

    expect(first.headers.get('X-RateLimit-Limit')).toBe(String(VOTE_LIMIT))
    expect(first.headers.get('X-RateLimit-Remaining')).toBe(
      String(VOTE_LIMIT - 1)
    )
    expect(second.headers.get('X-RateLimit-Remaining')).toBe(
      String(VOTE_LIMIT - 2)
    )
  })

  it('also reports the limit on a refused vote', async () => {
    vi.mocked(getEventById).mockResolvedValue(
      votingEvent('closed') as unknown as Event
    )

    const response = await POST(voteRequest(undefined, phone('203.0.113.7')))

    expect(response.status).toBe(403)
    expect(response.headers.get('X-RateLimit-Limit')).toBe(String(VOTE_LIMIT))
  })
})
