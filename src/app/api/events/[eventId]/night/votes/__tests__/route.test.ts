// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import type { Session } from 'next-auth'
import type { ProtectedApiHandler } from '@/lib/api-protection'

const auth = vi.hoisted(() => ({ session: null as Session | null }))

vi.mock('@/lib/api-protection', () => ({
  withAdminProtection:
    (handler: ProtectedApiHandler) =>
    (request: NextRequest, context?: unknown) =>
      handler(request, context, auth.session ?? undefined),
}))

vi.mock('@/lib/sql', () => ({ sql: vi.fn(), sqlQuery: vi.fn() }))

vi.mock('@/lib/db', () => ({
  getEventById: vi.fn(),
}))

// The real isUuid; only the write is mocked.
vi.mock('@/lib/db/night', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/night')>()),
  setCrowdVoteStatus: vi.fn(),
}))

vi.mock('@/lib/night', () => ({
  getNightState: vi.fn(),
}))

import { getEventById } from '@/lib/db'
import { setCrowdVoteStatus } from '@/lib/db/night'
import type { Event } from '@/lib/db-types'
import { getNightState } from '@/lib/night'
import type { NightState } from '@/lib/night-types'
import { PATCH } from '../route'

/** getEventById is typed as always finding the event, but returns null when it does not. */
const NO_EVENT = null as unknown as Event

const mockGetEventById = vi.mocked(getEventById)
const mockSetStatus = vi.mocked(setCrowdVoteStatus)
const mockGetNightState = vi.mocked(getNightState)

const EVENT_ID = 'sydney-2026'
const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

const state = {
  event: { id: EVENT_ID },
  generatedAt: '2026-10-08T10:00:00.000Z',
} as unknown as NightState

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

function uuid(i: number): string {
  const hex = i.toString(16).padStart(12, '0')
  return `00000000-0000-4000-8000-${hex}`
}

async function patch(body: unknown) {
  const request = {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest
  const response = await PATCH(request, {
    params: Promise.resolve({ eventId: EVENT_ID }),
  })
  return { status: response.status, body: await response.json() }
}

describe('PATCH /api/events/[eventId]/night/votes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    auth.session = {
      user: { isAdmin: true, email: 'admin@example.com', name: 'Admin' },
      expires: '2099-01-01T00:00:00Z',
    } as Session
    mockGetEventById.mockResolvedValue(event('closed'))
    mockGetNightState.mockResolvedValue(state)
    mockSetStatus.mockImplementation(async (_e, ids) => ids)
  })

  describe('validation', () => {
    it.each([
      ['an unknown status', { status: 'deleted', voteIds: [A] }],
      ['a missing status', { voteIds: [A] }],
      ['an upper-case status', { status: 'APPROVED', voteIds: [A] }],
    ])('answers 400 for %s', async (_label, body) => {
      const { status, body: data } = await patch(body)
      expect(status).toBe(400)
      expect(data.error).toContain("status must be 'approved'")
      expect(mockGetEventById).not.toHaveBeenCalled()
      expect(mockSetStatus).not.toHaveBeenCalled()
    })

    it.each([
      ['an empty list', []],
      ['a missing list', undefined],
      ['a single id that is not in a list', A],
      ['a non-UUID id', ['vote-1']],
      ['one bad id among good ones', [A, 'nope', B]],
      ['an id with SQL in it', [`${A}'); DELETE FROM votes;--`]],
      ['a number', [42]],
      ['more than 2000 ids', Array.from({ length: 2001 }, (_, i) => uuid(i))],
    ])('answers 400 for %s', async (_label, voteIds) => {
      const { status, body } = await patch({ status: 'approved', voteIds })
      expect(status).toBe(400)
      expect(body.error).toBe('voteIds must be a non-empty list of vote ids')
      expect(mockGetEventById).not.toHaveBeenCalled()
      expect(mockSetStatus).not.toHaveBeenCalled()
    })

    it('answers 400 for a body that is not JSON', async () => {
      const request = {
        json: vi.fn().mockRejectedValue(new SyntaxError('bad')),
      } as unknown as NextRequest
      const response = await PATCH(request, {
        params: Promise.resolve({ eventId: EVENT_ID }),
      })
      expect(response.status).toBe(400)
    })

    it('accepts exactly 2000 ids', async () => {
      const voteIds = Array.from({ length: 2000 }, (_, i) => uuid(i))
      const { status } = await patch({ status: 'approved', voteIds })
      expect(status).toBe(200)
    })
  })

  it('answers 404 for an unknown event', async () => {
    mockGetEventById.mockResolvedValue(NO_EVENT)
    const { status } = await patch({ status: 'approved', voteIds: [A] })
    expect(status).toBe(404)
    expect(mockSetStatus).not.toHaveBeenCalled()
  })

  it.each(['upcoming', 'locked', 'finalized', 'archived'])(
    'refuses with 409 while the event is %s, returning the state',
    async (eventStatus) => {
      mockGetEventById.mockResolvedValue(event(eventStatus))
      const { status, body } = await patch({ status: 'rejected', voteIds: [A] })
      expect(status).toBe(409)
      expect(body.error).toMatch(/^Votes cannot be changed while the event is/)
      expect(body.state).toEqual(state)
      expect(mockSetStatus).not.toHaveBeenCalled()
    }
  )

  it('names the phase in the refusal', async () => {
    mockGetEventById.mockResolvedValue(event('locked'))
    const { body } = await patch({ status: 'rejected', voteIds: [A] })
    expect(body.error).toBe(
      'Votes cannot be changed while the event is "Results locked".'
    )
  })

  it.each(['voting', 'closed'])(
    'updates the listed votes while the event is %s',
    async (eventStatus) => {
      mockGetEventById.mockResolvedValue(event(eventStatus))
      const { status, body } = await patch({
        status: 'rejected',
        voteIds: [A, B],
      })
      expect(status).toBe(200)
      expect(body).toEqual({ updated: 2, state })
      expect(mockSetStatus).toHaveBeenCalledWith(
        EVENT_ID,
        [A, B],
        'rejected',
        'admin@example.com'
      )
    }
  )

  it.each(['approved', 'rejected', 'pending'])(
    'accepts the decision %s',
    async (decision) => {
      const { status } = await patch({ status: decision, voteIds: [A] })
      expect(status).toBe(200)
      expect(mockSetStatus.mock.calls[0][2]).toBe(decision)
    }
  )

  it('sends each id once', async () => {
    await patch({ status: 'approved', voteIds: [A, B, A, A] })
    expect(mockSetStatus.mock.calls[0][1]).toEqual([A, B])
  })

  it('reports how many votes actually changed', async () => {
    mockSetStatus.mockResolvedValue([A])
    const { body } = await patch({ status: 'approved', voteIds: [A, B] })
    expect(body.updated).toBe(1)
  })

  it('records the admin name when there is no email', async () => {
    auth.session = {
      user: { isAdmin: true, name: 'Dean' },
      expires: '2099-01-01T00:00:00Z',
    } as Session
    await patch({ status: 'approved', voteIds: [A] })
    expect(mockSetStatus.mock.calls[0][3]).toBe('Dean')
  })

  it('answers 500 when the update fails', async () => {
    mockSetStatus.mockRejectedValue(new Error('db down'))
    const { status, body } = await patch({ status: 'approved', voteIds: [A] })
    expect(status).toBe(500)
    expect(body).toEqual({ error: 'Failed to update the votes' })
  })
})
