// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import type { Session } from 'next-auth'
import type { ApiHandler } from '@/lib/api-protection'

vi.mock('@/lib/api-protection', () => ({
  withPublicRateLimit: (handler: ApiHandler) => handler,
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  getBandScores: vi.fn(),
  getEventById: vi.fn(),
  hasFinalizedResults: vi.fn(),
  getFinalizedResults: vi.fn(),
}))

import { auth } from '@/lib/auth'
import {
  getBandScores,
  getEventById,
  getFinalizedResults,
  hasFinalizedResults,
} from '@/lib/db'
import type { Event, FinalizedResult } from '@/lib/db-types'
import { GET } from '../route'

/** getEventById is typed as always finding the event, but returns null when it does not. */
const NO_EVENT = null as unknown as Event

// `auth` is overloaded (session getter and middleware wrapper); the route only
// ever awaits it for a session.
const mockAuth = vi.mocked(auth) as unknown as ReturnType<
  typeof vi.fn<() => Promise<Session | null>>
>
const mockGetBandScores = vi.mocked(getBandScores)
const mockGetEventById = vi.mocked(getEventById)
const mockHasFinalized = vi.mocked(hasFinalizedResults)
const mockGetFinalized = vi.mocked(getFinalizedResults)

const EVENT_ID = 'sydney-2026'

function event(status: string): Event {
  return {
    id: EVENT_ID,
    name: 'Sydney 2026',
    date: '2026-10-08T08:00:00Z',
    location: 'Factory Theatre',
    timezone: 'Australia/Sydney',
    created_at: '2026-01-01T00:00:00Z',
    is_active: true,
    status: status as Event['status'],
  }
}

function session(isAdmin: boolean): Session {
  return {
    user: { isAdmin, email: 'someone@example.com' },
    expires: '2099-01-01T00:00:00Z',
  } as Session
}

const liveScores = [{ id: 'b1', name: 'The Rockers', crowd_vote_count: '12' }]

const frozen: FinalizedResult = {
  id: 'f1',
  event_id: EVENT_ID,
  band_id: 'b1',
  band_name: 'The Rockers',
  final_rank: 1,
  avg_song_choice: 15,
  avg_performance: 16,
  avg_crowd_vibe: 17,
  avg_visuals: 18,
  crowd_vote_count: 12,
  judge_vote_count: 3,
  total_crowd_votes: 20,
  crowd_noise_energy: null,
  crowd_noise_peak: null,
  crowd_noise_score: null,
  judge_score: 66,
  crowd_score: 20,
  visuals_score: 18,
  total_score: 86,
  finalized_at: '2026-10-08T11:00:00Z',
}

async function get() {
  const request = {
    url: `http://localhost:3000/api/events/${EVENT_ID}/scores`,
  } as NextRequest
  const response = await GET(request)
  return { status: response.status, body: await response.json() }
}

describe('GET /api/events/[eventId]/scores', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockAuth.mockResolvedValue(null)
    mockGetBandScores.mockResolvedValue(liveScores)
    mockHasFinalized.mockResolvedValue(false)
    mockGetFinalized.mockResolvedValue([])
  })

  describe.each(['upcoming', 'voting', 'closed', 'locked'])(
    'while the event is %s',
    (status) => {
      beforeEach(() => {
        mockGetEventById.mockResolvedValue(event(status))
      })

      it('answers 403 without a session and does not read the scores', async () => {
        const { status: code, body } = await get()
        expect(code).toBe(403)
        expect(body).toEqual({
          error: 'Scores are not available until results are released',
        })
        expect(mockGetBandScores).not.toHaveBeenCalled()
      })

      it('answers 403 for a signed-in user who is not an admin', async () => {
        mockAuth.mockResolvedValue(session(false))
        const { status: code } = await get()
        expect(code).toBe(403)
        expect(mockGetBandScores).not.toHaveBeenCalled()
      })

      it('returns the live scores to an admin', async () => {
        mockAuth.mockResolvedValue(session(true))
        const { status: code, body } = await get()
        expect(code).toBe(200)
        expect(body).toEqual(liveScores)
        expect(mockGetBandScores).toHaveBeenCalledWith(EVENT_ID)
      })
    }
  )

  it('does not hand a locked event its frozen results before release', async () => {
    mockGetEventById.mockResolvedValue(event('locked'))
    mockHasFinalized.mockResolvedValue(true)
    mockGetFinalized.mockResolvedValue([frozen])
    const { status } = await get()
    expect(status).toBe(403)
    expect(mockGetFinalized).not.toHaveBeenCalled()
  })

  it('answers 403 for an unknown event without an admin session', async () => {
    mockGetEventById.mockResolvedValue(NO_EVENT)
    const { status } = await get()
    expect(status).toBe(403)
    expect(mockGetBandScores).not.toHaveBeenCalled()
  })

  it('returns the frozen results of a finalized event to anyone', async () => {
    mockGetEventById.mockResolvedValue(event('finalized'))
    mockHasFinalized.mockResolvedValue(true)
    mockGetFinalized.mockResolvedValue([frozen])
    const { status, body } = await get()
    expect(status).toBe(200)
    expect(body).toEqual([
      {
        id: 'b1',
        name: 'The Rockers',
        order: 1,
        avg_song_choice: 15,
        avg_performance: 16,
        avg_crowd_vibe: 17,
        avg_visuals: 18,
        avg_crowd_vote: null,
        crowd_vote_count: 12,
        judge_vote_count: 3,
        total_crowd_votes: 20,
        crowd_noise_energy: null,
        crowd_noise_peak: null,
        crowd_score: null,
      },
    ])
    expect(mockAuth).not.toHaveBeenCalled()
    expect(mockGetBandScores).not.toHaveBeenCalled()
  })

  it('returns calculated scores for a finalized event with no frozen rows (legacy) to anyone', async () => {
    mockGetEventById.mockResolvedValue(event('finalized'))
    const { status, body } = await get()
    expect(status).toBe(200)
    expect(body).toEqual(liveScores)
    expect(mockAuth).not.toHaveBeenCalled()
  })

  it('answers 500 when the scores cannot be read', async () => {
    mockGetEventById.mockRejectedValue(new Error('db down'))
    const { status, body } = await get()
    expect(status).toBe(500)
    expect(body).toEqual({ error: 'Failed to fetch band scores' })
  })
})
