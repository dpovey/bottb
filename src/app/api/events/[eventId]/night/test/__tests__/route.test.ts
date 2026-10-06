// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NextRequest } from 'next/server'
import type { ProtectedApiHandler } from '@/lib/api-protection'

vi.mock('@/lib/api-protection', () => ({
  withAdminProtection: (handler: ProtectedApiHandler) => handler,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/sql', () => ({ sql: vi.fn(), sqlQuery: vi.fn() }))

vi.mock('@/lib/db', () => ({
  getEventById: vi.fn(),
  getBandsForEvent: vi.fn(),
}))

vi.mock('@/lib/db/night', () => ({
  hasJudgeSubmitted: vi.fn(),
  insertJudgeSheet: vi.fn(),
  insertSimulatedCrowdVotes: vi.fn(),
  resetTestEvent: vi.fn(),
}))

// Keep the real getPathsToRevalidate.
vi.mock('@/lib/night', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/night')>()),
  getNightState: vi.fn(),
}))

import { revalidatePath } from 'next/cache'
import { getBandsForEvent, getEventById } from '@/lib/db'
import {
  hasJudgeSubmitted,
  insertJudgeSheet,
  insertSimulatedCrowdVotes,
  resetTestEvent,
  type JudgeSheetRow,
} from '@/lib/db/night'
import type { Band, Event } from '@/lib/db-types'
import { getNightState } from '@/lib/night'
import type { NightState } from '@/lib/night-types'
import { POST } from '../route'

/** getEventById is typed as always finding the event, but returns null when it does not. */
const NO_EVENT = null as unknown as Event

const mocks = {
  getEventById: vi.mocked(getEventById),
  getBandsForEvent: vi.mocked(getBandsForEvent),
  hasJudgeSubmitted: vi.mocked(hasJudgeSubmitted),
  insertJudgeSheet: vi.mocked(insertJudgeSheet),
  insertSimulatedCrowdVotes: vi.mocked(insertSimulatedCrowdVotes),
  resetTestEvent: vi.mocked(resetTestEvent),
  getNightState: vi.mocked(getNightState),
}

const EVENT_ID = 'test-night'
const ACTIONS = ['reset', 'simulate-crowd', 'simulate-judges'] as const

const state = {
  event: { id: EVENT_ID },
  generatedAt: '2026-10-08T10:00:00.000Z',
} as unknown as NightState

function event(
  status: string,
  isTest: boolean | undefined,
  scoringVersion = '2026.2'
): Event {
  return {
    id: EVENT_ID,
    name: 'Test Night (rehearsal)',
    date: '2026-10-08T08:00:00Z',
    location: 'Rehearsal',
    timezone: 'Australia/Sydney',
    created_at: '2026-01-01T00:00:00Z',
    is_active: false,
    status: status as Event['status'],
    is_test: isTest,
    info: { scoring_version: scoringVersion } as Event['info'],
  }
}

const bands: Band[] = [1, 2, 3].map((i) => ({
  id: `b${i}`,
  event_id: EVENT_ID,
  name: `Band ${i}`,
  order: i,
  created_at: '2026-01-01T00:00:00Z',
}))

async function post(body: unknown) {
  const request = {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest
  const response = await POST(request, {
    params: Promise.resolve({ eventId: EVENT_ID }),
  })
  return { status: response.status, body: await response.json() }
}

function expectNothingWritten() {
  expect(mocks.resetTestEvent).not.toHaveBeenCalled()
  expect(mocks.insertSimulatedCrowdVotes).not.toHaveBeenCalled()
  expect(mocks.insertJudgeSheet).not.toHaveBeenCalled()
}

describe('POST /api/events/[eventId]/night/test (rehearsal tools)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getEventById.mockResolvedValue(event('voting', true))
    mocks.getBandsForEvent.mockResolvedValue(bands)
    mocks.getNightState.mockResolvedValue(state)
    mocks.resetTestEvent.mockResolvedValue(true)
    mocks.insertSimulatedCrowdVotes.mockResolvedValue({ added: 40, held: 9 })
    mocks.hasJudgeSubmitted.mockResolvedValue(false)
    mocks.insertJudgeSheet.mockImplementation(
      async (_e, _n, rows) => rows.length
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('real events are never touched', () => {
    describe.each([
      ['is_test false', false],
      ['is_test missing', undefined],
    ])('%s', (_label, isTest) => {
      it.each(ACTIONS)('answers 403 for %s', async (action) => {
        for (const status of ['upcoming', 'voting', 'closed']) {
          mocks.getEventById.mockResolvedValue(event(status, isTest))
          const { status: code, body } = await post({ action, count: 10 })
          expect(code).toBe(403)
          expect(body).toEqual({
            error: 'Rehearsal tools only work on the test event.',
          })
        }
        expectNothingWritten()
        expect(mocks.hasJudgeSubmitted).not.toHaveBeenCalled()
        expect(revalidatePath).not.toHaveBeenCalled()
      })
    })

    it('treats a truthy but non-boolean is_test as a real event', async () => {
      mocks.getEventById.mockResolvedValue({
        ...event('voting', undefined),
        is_test: 'true' as unknown as boolean,
      })
      for (const action of ACTIONS) {
        const { status } = await post({ action })
        expect(status).toBe(403)
      }
      expectNothingWritten()
    })
  })

  it.each([{ action: 'delete-everything' }, {}, null])(
    'answers 400 for an unknown action (%j)',
    async (body) => {
      const { status, body: data } = await post(body)
      expect(status).toBe(400)
      expect(data).toEqual({ error: 'Unknown action' })
      expect(mocks.getEventById).not.toHaveBeenCalled()
      expectNothingWritten()
    }
  )

  it('answers 404 for an unknown event', async () => {
    mocks.getEventById.mockResolvedValue(NO_EVENT)
    const { status } = await post({ action: 'reset' })
    expect(status).toBe(404)
    expectNothingWritten()
  })

  describe('reset', () => {
    it('resets the test event and revalidates its pages', async () => {
      const { status, body } = await post({ action: 'reset' })
      expect(status).toBe(200)
      expect(body).toEqual({
        message: 'Test event reset. All votes and scores are gone.',
        state,
      })
      expect(mocks.resetTestEvent).toHaveBeenCalledWith(EVENT_ID)
      expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual([
        '/',
        '/events',
        `/event/${EVENT_ID}`,
        `/results/${EVENT_ID}`,
      ])
    })
  })

  describe('simulate-crowd', () => {
    it.each(['upcoming', 'closed', 'locked', 'finalized'])(
      'refuses with 409 while the test event is %s',
      async (status) => {
        mocks.getEventById.mockResolvedValue(event(status, true))
        const { status: code, body } = await post({ action: 'simulate-crowd' })
        expect(code).toBe(409)
        expect(body.error).toContain('Open crowd voting first')
        expect(body.state).toEqual(state)
        expect(mocks.insertSimulatedCrowdVotes).not.toHaveBeenCalled()
      }
    )

    it('adds votes for the event bands while voting is open', async () => {
      const { status, body } = await post({ action: 'simulate-crowd' })
      expect(status).toBe(200)
      expect(body.message).toBe(
        'Added 40 simulated crowd votes (9 held for review).'
      )
      expect(mocks.insertSimulatedCrowdVotes).toHaveBeenCalledWith(
        EVENT_ID,
        ['b1', 'b2', 'b3'],
        40
      )
    })

    it.each([
      [undefined, 40],
      [12, 12],
      ['12', 12],
      [0, 1],
      [-5, 1],
      [1000, 200],
      [2.5, 40],
      ['lots', 40],
    ])('turns count %j into %i', async (count, expected) => {
      await post({ action: 'simulate-crowd', count })
      expect(mocks.insertSimulatedCrowdVotes.mock.calls[0][2]).toBe(expected)
    })
  })

  describe('simulate-judges', () => {
    it.each(['locked', 'finalized'])(
      'refuses with 409 once the test event is %s',
      async (status) => {
        mocks.getEventById.mockResolvedValue(event(status, true))
        const { status: code, body } = await post({ action: 'simulate-judges' })
        expect(code).toBe(409)
        expect(body.error).toBe(
          'Judge scores cannot be added once results are locked.'
        )
        expect(mocks.insertJudgeSheet).not.toHaveBeenCalled()
      }
    )

    it('adds three judge sheets covering every band, with scores in range', async () => {
      const { status, body } = await post({ action: 'simulate-judges' })
      expect(status).toBe(200)
      expect(body.message).toBe('Added 3 simulated judge sheets.')
      expect(mocks.insertJudgeSheet).toHaveBeenCalledTimes(3)
      for (const [eventId, , rows] of mocks.insertJudgeSheet.mock.calls) {
        expect(eventId).toBe(EVENT_ID)
        expect(rows.map((r: JudgeSheetRow) => r.band_id)).toEqual([
          'b1',
          'b2',
          'b3',
        ])
        for (const r of rows) {
          // 2026.2: every judge category is out of 20; top half is 10–20.
          for (const v of [
            r.song_choice,
            r.performance,
            r.crowd_vibe,
            r.visuals,
          ]) {
            expect(v).toBeGreaterThanOrEqual(10)
            expect(v).toBeLessThanOrEqual(20)
          }
        }
      }
    })

    it('keeps scores inside the 2025.1 maxima and leaves visuals empty', async () => {
      mocks.getEventById.mockResolvedValue(event('closed', true, '2025.1'))
      await post({ action: 'simulate-judges' })
      for (const [, , rows] of mocks.insertJudgeSheet.mock.calls) {
        for (const r of rows) {
          expect(r.song_choice).toBeLessThanOrEqual(20)
          expect(r.performance).toBeLessThanOrEqual(30)
          expect(r.crowd_vibe).toBeLessThanOrEqual(30)
          expect(r.visuals).toBeNull()
        }
      }
    })

    it('skips judges already entered', async () => {
      mocks.hasJudgeSubmitted.mockImplementation(
        async (_e, name) => name !== 'Rehearsal Judge 3'
      )
      const { body } = await post({ action: 'simulate-judges' })
      expect(mocks.insertJudgeSheet).toHaveBeenCalledTimes(1)
      expect(mocks.insertJudgeSheet.mock.calls[0][1]).toBe('Rehearsal Judge 3')
      expect(body.message).toBe('Added 1 simulated judge sheet.')
    })

    it('says so when every simulated judge is already in', async () => {
      mocks.hasJudgeSubmitted.mockResolvedValue(true)
      const { body } = await post({ action: 'simulate-judges' })
      expect(body.message).toBe(
        'The simulated judges have already been entered.'
      )
      expect(mocks.insertJudgeSheet).not.toHaveBeenCalled()
    })
  })

  it('answers 500 when a rehearsal tool fails', async () => {
    mocks.resetTestEvent.mockRejectedValue(new Error('db down'))
    const { status, body } = await post({ action: 'reset' })
    expect(status).toBe(500)
    expect(body).toEqual({ error: 'The rehearsal tool failed' })
  })
})
