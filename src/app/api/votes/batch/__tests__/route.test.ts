// @vitest-environment node

/**
 * POST /api/votes/batch — one judge's whole sheet, admin only. A sheet is
 * validated as a whole and saved all-or-nothing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/server', async (importOriginal) => importOriginal())
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  getEventById: vi.fn(),
  getBandsForEvent: vi.fn(),
}))
vi.mock('@/lib/db/night', () => ({
  hasJudgeSubmitted: vi.fn(),
  insertJudgeSheet: vi.fn(),
}))
vi.mock('@/lib/sql', () => ({ sql: vi.fn(), sqlQuery: vi.fn() }))

import { NextRequest } from 'next/server'
import type { Session } from 'next-auth'
import { POST } from '../route'
import { auth } from '@/lib/auth'
import { getBandsForEvent, getEventById } from '@/lib/db'
import { hasJudgeSubmitted, insertJudgeSheet } from '@/lib/db/night'
import { clearRateLimitStore } from '@/lib/api-protection'
import type { Band, Event } from '@/lib/db-types'

const EVENT_ID = 'sydney-2026'
const JUDGE = 'Judge Dredd'
const BANDS = [
  { id: 'band-a', name: 'The Compilers' },
  { id: 'band-b', name: 'Stack Overflow' },
  { id: 'band-c', name: 'Null Pointers' },
]

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>)
const mockGetEvent = vi.mocked(getEventById)
const mockGetBands = vi.mocked(getBandsForEvent)
const mockHasSubmitted = vi.mocked(hasJudgeSubmitted)
const mockInsert = vi.mocked(insertJudgeSheet)

function event(status = 'voting', scoringVersion: string | null = '2026.2') {
  return {
    id: EVENT_ID,
    name: 'Sydney 2026',
    date: '2026-10-08T08:00:00Z',
    location: 'Factory Theatre',
    timezone: 'Australia/Sydney',
    is_active: true,
    status,
    info: scoringVersion ? { scoring_version: scoringVersion } : {},
  } as unknown as Event
}

interface Row {
  event_id?: unknown
  band_id?: unknown
  voter_type?: unknown
  name?: unknown
  song_choice?: unknown
  performance?: unknown
  crowd_vibe?: unknown
  visuals?: unknown
}

/** A complete, valid 2026.2 sheet for every band. */
function sheet(overrides: Partial<Row> = {}): Row[] {
  return BANDS.map((band, i) => ({
    event_id: EVENT_ID,
    band_id: band.id,
    voter_type: 'judge',
    name: JUDGE,
    song_choice: 15 + i,
    performance: 14 + i,
    crowd_vibe: 13 + i,
    visuals: 12 + i,
    ...overrides,
  }))
}

function batchRequest(
  body: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest('http://localhost/api/votes/batch', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'Admin iPad',
      'x-forwarded-for': '203.0.113.9',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function expectRefused(response: Response, status: number) {
  expect(response.status).toBe(status)
  expect(mockInsert).not.toHaveBeenCalled()
  return (await response.json()) as { error: string }
}

beforeEach(() => {
  vi.clearAllMocks()
  clearRateLimitStore()
  mockAuth.mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@example.com', isAdmin: true },
    expires: '2099-01-01T00:00:00Z',
  } as unknown as Session)
  mockGetEvent.mockResolvedValue(event())
  mockGetBands.mockResolvedValue(BANDS as unknown as Band[])
  mockHasSubmitted.mockResolvedValue(false)
  mockInsert.mockImplementation(async (_e, _j, rows) => rows.length)
})

describe('POST /api/votes/batch', () => {
  describe('access', () => {
    it('returns 401 when nobody is signed in', async () => {
      mockAuth.mockResolvedValue(null)

      await expectRefused(await POST(batchRequest({ votes: sheet() })), 401)
      expect(mockGetEvent).not.toHaveBeenCalled()
    })

    it('returns 401 for a signed-in user who is not an admin', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', isAdmin: false },
        expires: '2099-01-01T00:00:00Z',
      } as unknown as Session)

      await expectRefused(await POST(batchRequest({ votes: sheet() })), 401)
    })
  })

  describe('saving a sheet', () => {
    it("saves every band's scores in one go and returns them", async () => {
      const response = await POST(batchRequest({ votes: sheet() }))

      expect(response.status).toBe(200)
      expect(mockInsert).toHaveBeenCalledTimes(1)
      expect(mockInsert).toHaveBeenCalledWith(
        EVENT_ID,
        JUDGE,
        [
          {
            band_id: 'band-a',
            song_choice: 15,
            performance: 14,
            crowd_vibe: 13,
            visuals: 12,
          },
          {
            band_id: 'band-b',
            song_choice: 16,
            performance: 15,
            crowd_vibe: 14,
            visuals: 13,
          },
          {
            band_id: 'band-c',
            song_choice: 17,
            performance: 16,
            crowd_vibe: 15,
            visuals: 14,
          },
        ],
        { ip_address: '203.0.113.9', user_agent: 'Admin iPad' }
      )
      const body = await response.json()
      expect(body.votes).toHaveLength(3)
      expect(body.votes[0]).toEqual({
        band_id: 'band-a',
        song_choice: 15,
        performance: 14,
        crowd_vibe: 13,
        visuals: 12,
        name: JUDGE,
        event_id: EVENT_ID,
      })
    })

    describe('with special guests (a non-competing band) in the event', () => {
      const GUEST = {
        id: 'band-guest',
        name: 'ShipReX',
        info: { non_competing: true },
      }

      beforeEach(() => {
        mockGetBands.mockResolvedValue([GUEST, ...BANDS] as unknown as Band[])
      })

      it('accepts a sheet of only the competing bands', async () => {
        const response = await POST(batchRequest({ votes: sheet() }))

        expect(response.status).toBe(200)
        expect(mockInsert.mock.calls[0][2].map((r) => r.band_id)).toEqual([
          'band-a',
          'band-b',
          'band-c',
        ])
      })

      it('refuses a sheet that scores the special guests', async () => {
        const votes = [...sheet(), { ...sheet()[0], band_id: GUEST.id }]

        const body = await expectRefused(
          await POST(batchRequest({ votes })),
          400
        )
        expect(body.error).toBe(
          'ShipReX are special guests and are not judged. Leave them off the sheet.'
        )
      })

      it('still requires every competing band', async () => {
        const body = await expectRefused(
          await POST(batchRequest({ votes: sheet().slice(1) })),
          400
        )
        expect(body.error).toBe('The sheet is missing scores for The Compilers')
      })
    })

    it('accepts the bands in any order', async () => {
      const response = await POST(
        batchRequest({ votes: [...sheet()].reverse() })
      )

      expect(response.status).toBe(200)
      expect(mockInsert).toHaveBeenCalledTimes(1)
    })

    it("trims the judge's name", async () => {
      await POST(batchRequest({ votes: sheet({ name: `  ${JUDGE}  ` }) }))

      expect(mockHasSubmitted).toHaveBeenCalledWith(EVENT_ID, JUDGE)
      expect(mockInsert.mock.calls[0][1]).toBe(JUDGE)
    })

    it('ignores client-supplied fingerprints and other extra fields', async () => {
      await POST(
        batchRequest({
          votes: sheet().map((row) => ({
            ...row,
            vote_fingerprint: 'chosen-by-client',
            crowd_vote: 20,
            status: 'pending',
          })),
        })
      )

      for (const row of mockInsert.mock.calls[0][2]) {
        expect(Object.keys(row).sort()).toEqual([
          'band_id',
          'crowd_vibe',
          'performance',
          'song_choice',
          'visuals',
        ])
      }
    })

    it('records no IP address when the forwarded one is not valid', async () => {
      await POST(
        batchRequest({ votes: sheet() }, { 'x-forwarded-for': 'garbage' })
      )

      expect(mockInsert.mock.calls[0][3]).toEqual({
        ip_address: null,
        user_agent: 'Admin iPad',
      })
    })

    it('refuses an empty sheet and saves nothing', async () => {
      const body = await expectRefused(
        await POST(batchRequest({ votes: [] })),
        400
      )

      expect(body.error).toBe('The sheet has no scores on it')
      expect(mockGetEvent).not.toHaveBeenCalled()
      expect(mockHasSubmitted).not.toHaveBeenCalled()
    })
  })

  describe('event status', () => {
    it.each(['upcoming', 'voting', 'closed'])(
      'accepts a sheet while the event is %s',
      async (status) => {
        mockGetEvent.mockResolvedValue(event(status))

        const response = await POST(batchRequest({ votes: sheet() }))

        expect(response.status).toBe(200)
        expect(mockInsert).toHaveBeenCalledTimes(1)
      }
    )

    it.each([
      ['locked', 'Results locked'],
      ['finalized', 'Results released'],
      ['archived', 'archived'],
    ])('returns 403 while the event is %s', async (status, label) => {
      mockGetEvent.mockResolvedValue(event(status))

      const body = await expectRefused(
        await POST(batchRequest({ votes: sheet() })),
        403
      )
      expect(body).toEqual({
        error: `Judge scores cannot be entered while the event is "${label}"`,
        eventStatus: status,
      })
    })

    it('returns 404 for an unknown event', async () => {
      mockGetEvent.mockResolvedValue(null as unknown as Event)

      const body = await expectRefused(
        await POST(batchRequest({ votes: sheet() })),
        404
      )
      expect(body.error).toBe('Event not found')
    })

    it('returns 409 when the status moves on between the check and the save', async () => {
      mockInsert.mockResolvedValue(0)

      const response = await POST(batchRequest({ votes: sheet() }))

      expect(response.status).toBe(409)
      expect((await response.json()).error).toMatch(/status changed/)
    })

    it('returns 409 when only part of the sheet was saved', async () => {
      mockInsert.mockResolvedValue(2)

      const response = await POST(batchRequest({ votes: sheet() }))

      expect(response.status).toBe(409)
    })
  })

  describe('one sheet per judge', () => {
    it('returns 409 when that judge already has a sheet', async () => {
      mockHasSubmitted.mockResolvedValue(true)

      const body = await expectRefused(
        await POST(batchRequest({ votes: sheet() })),
        409
      )
      expect(body.error).toBe(`Already recorded a vote for judge: ${JUDGE}`)
      expect(mockHasSubmitted).toHaveBeenCalledWith(EVENT_ID, JUDGE)
    })

    it('returns 409 when the same sheet is saved twice at once', async () => {
      mockInsert.mockRejectedValue(
        Object.assign(new Error('duplicate key'), { code: '23505' })
      )

      const response = await POST(batchRequest({ votes: sheet() }))

      expect(response.status).toBe(409)
      expect((await response.json()).error).toBe(
        `Already recorded a vote for judge: ${JUDGE}`
      )
    })

    it('returns 500 for any other database failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockInsert.mockRejectedValue(new Error('connection reset'))

      const response = await POST(batchRequest({ votes: sheet() }))

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Failed to submit votes' })
      consoleSpy.mockRestore()
    })
  })

  describe('sheet validation', () => {
    it.each([
      ['the body is not JSON', 'votes=1'],
      ['votes is missing', {}],
      ['votes is not a list', { votes: { band_id: 'band-a' } }],
    ])('returns 400 when %s', async (_case, body) => {
      const result = await expectRefused(await POST(batchRequest(body)), 400)
      expect(result.error).toBe('Invalid votes data')
    })

    it('requires an event id', async () => {
      const body = await expectRefused(
        await POST(batchRequest({ votes: sheet({ event_id: undefined }) })),
        400
      )
      expect(body.error).toBe('event_id is required')
    })

    it.each([
      ['missing', undefined],
      ['blank', '   '],
    ])("requires the judge's name (%s)", async (_case, name) => {
      const body = await expectRefused(
        await POST(batchRequest({ votes: sheet({ name }) })),
        400
      )
      expect(body.error).toBe("The judge's name is required")
    })

    it("limits the judge's name to 100 characters", async () => {
      const body = await expectRefused(
        await POST(batchRequest({ votes: sheet({ name: 'J'.repeat(101) }) })),
        400
      )
      expect(body.error).toMatch(/100 characters or fewer/)

      mockInsert.mockClear()
      const ok = await POST(
        batchRequest({ votes: sheet({ name: 'J'.repeat(100) }) })
      )
      expect(ok.status).toBe(200)
    })

    it.each<[string, (rows: Row[]) => void]>([
      ['two judges', (rows) => (rows[1].name = 'Someone Else')],
      ['two events', (rows) => (rows[2].event_id = 'other-event')],
      ['a crowd vote', (rows) => (rows[0].voter_type = 'crowd')],
      ['a row with no voter type', (rows) => delete rows[1].voter_type],
    ])('refuses a sheet that mixes in %s', async (_case, spoil) => {
      const rows = sheet()
      spoil(rows)

      const body = await expectRefused(
        await POST(batchRequest({ votes: rows })),
        400
      )
      expect(body.error).toBe(
        'A sheet must contain judge scores from one judge for one event'
      )
    })

    it('treats the same name with stray spaces as the same judge', async () => {
      const rows = sheet()
      rows[1].name = ` ${JUDGE} `

      const response = await POST(batchRequest({ votes: rows }))

      expect(response.status).toBe(200)
    })

    it('refuses a band that is not in the event', async () => {
      const rows = sheet()
      rows[2].band_id = 'band-from-another-event'

      const body = await expectRefused(
        await POST(batchRequest({ votes: rows })),
        400
      )
      expect(body.error).toBe(
        'The sheet includes a band that is not in this event'
      )
    })

    it('refuses a band scored twice', async () => {
      const rows = sheet()
      rows[2].band_id = 'band-b'

      const body = await expectRefused(
        await POST(batchRequest({ votes: rows })),
        400
      )
      expect(body.error).toBe(
        'Stack Overflow appears more than once on the sheet'
      )
    })

    it('refuses a sheet that leaves bands out, naming them', async () => {
      const body = await expectRefused(
        await POST(batchRequest({ votes: sheet().slice(0, 1) })),
        400
      )
      expect(body.error).toBe(
        'The sheet is missing scores for Stack Overflow, Null Pointers'
      )
    })

    it('does not check for an earlier sheet until this one is valid', async () => {
      await POST(batchRequest({ votes: sheet().slice(0, 1) }))

      expect(mockHasSubmitted).not.toHaveBeenCalled()
    })
  })

  describe('score validation', () => {
    it.each<[string, Partial<Row>, string]>([
      [
        'a fraction',
        { song_choice: 12.5 },
        'Song Choice for The Compilers must be a whole number from 0 to 20',
      ],
      [
        'a negative score',
        { performance: -1 },
        'Performance for The Compilers must be a whole number from 0 to 20',
      ],
      [
        'a score above the maximum',
        { crowd_vibe: 21 },
        'Crowd Vibe for The Compilers must be a whole number from 0 to 20',
      ],
      [
        'a number sent as text',
        { visuals: '15' },
        'Visuals for The Compilers must be a whole number from 0 to 20',
      ],
      [
        'a missing score',
        { visuals: undefined },
        'Visuals for The Compilers must be a whole number from 0 to 20',
      ],
      [
        'a null score',
        { song_choice: null },
        'Song Choice for The Compilers must be a whole number from 0 to 20',
      ],
    ])('refuses %s', async (_case, scores, message) => {
      const rows = sheet()
      Object.assign(rows[0], scores)

      const body = await expectRefused(
        await POST(batchRequest({ votes: rows })),
        400
      )
      expect(body.error).toBe(message)
    })

    it('accepts the ends of the range', async () => {
      const rows = sheet()
      Object.assign(rows[0], {
        song_choice: 0,
        performance: 20,
        crowd_vibe: 0,
        visuals: 20,
      })

      const response = await POST(batchRequest({ votes: rows }))

      expect(response.status).toBe(200)
      expect(mockInsert.mock.calls[0][2][0]).toMatchObject({
        song_choice: 0,
        performance: 20,
        crowd_vibe: 0,
        visuals: 20,
      })
    })

    it("uses the event's scoring version for the maximums (2026.1: performance out of 30)", async () => {
      mockGetEvent.mockResolvedValue(event('voting', '2026.1'))
      const rows = sheet()
      rows[0].performance = 30

      expect((await POST(batchRequest({ votes: rows }))).status).toBe(200)

      mockInsert.mockClear()
      rows[0].performance = 31
      const body = await expectRefused(
        await POST(batchRequest({ votes: rows })),
        400
      )
      expect(body.error).toBe(
        'Performance for The Compilers must be a whole number from 0 to 30'
      )
    })

    it('scores 2026.1 crowd vibe out of 20', async () => {
      mockGetEvent.mockResolvedValue(event('voting', '2026.1'))
      const rows = sheet()
      rows[0].crowd_vibe = 21

      await expectRefused(await POST(batchRequest({ votes: rows })), 400)
    })

    it('stores no visuals score for a version without that category (2025.1)', async () => {
      mockGetEvent.mockResolvedValue(event('voting', '2025.1'))
      const rows = sheet({ visuals: 999 })
      rows[0].crowd_vibe = 30

      const response = await POST(batchRequest({ votes: rows }))

      expect(response.status).toBe(200)
      const saved = mockInsert.mock.calls[0][2]
      expect(saved.every((row) => row.visuals === null)).toBe(true)
      expect(saved[0].crowd_vibe).toBe(30)
    })

    it('uses the default version (2026.2) when the event has none', async () => {
      mockGetEvent.mockResolvedValue(event('voting', null))
      const rows = sheet()
      rows[0].performance = 21

      const body = await expectRefused(
        await POST(batchRequest({ votes: rows })),
        400
      )
      expect(body.error).toMatch(/from 0 to 20$/)
    })
  })
})
