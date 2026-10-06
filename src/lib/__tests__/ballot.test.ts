import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../db', () => ({
  getEventById: vi.fn(),
  getBandsForEvent: vi.fn(),
}))

import { getBandsForEvent, getEventById } from '../db'
import { clearBallotCache, getBallot } from '../ballot'

/** getEventById is typed as always finding the event, but returns null when it does not. */
const NO_EVENT = null as unknown as Event
import type { Band, Event } from '../db-types'

const mockGetEventById = vi.mocked(getEventById)
const mockGetBandsForEvent = vi.mocked(getBandsForEvent)

function event(status: string, overrides: Partial<Event> = {}): Event {
  return {
    id: 'sydney-2026',
    name: 'Sydney 2026',
    date: '2026-10-08T08:00:00Z',
    location: 'Factory Theatre',
    timezone: 'Australia/Sydney',
    created_at: '2026-01-01T00:00:00Z',
    is_active: true,
    status: status as Event['status'],
    ...overrides,
  }
}

const bands: Band[] = [
  {
    id: 'band-1',
    event_id: 'sydney-2026',
    name: 'The Rockers',
    order: 1,
    company_name: 'Acme',
    hero_thumbnail_url: 'https://example.com/hero.jpg',
    info: { logo_url: 'https://example.com/logo.png', genre: 'rock' },
    description: 'Secret notes',
    created_at: '2026-01-01T00:00:00Z',
  } as Band,
  {
    id: 'band-2',
    event_id: 'sydney-2026',
    name: 'The Rollers',
    order: 2,
    created_at: '2026-01-01T00:00:00Z',
  } as Band,
]

describe('getBallot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearBallotCache()
    mockGetBandsForEvent.mockResolvedValue(bands)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the event and only the fields the voting page needs for each band', async () => {
    mockGetEventById.mockResolvedValue(event('voting'))
    const ballot = await getBallot('sydney-2026')
    expect(ballot).toEqual({
      event: {
        id: 'sydney-2026',
        name: 'Sydney 2026',
        status: 'voting',
        votingOpen: true,
      },
      bands: [
        {
          id: 'band-1',
          name: 'The Rockers',
          order: 1,
          company_name: 'Acme',
          hero_thumbnail_url: 'https://example.com/hero.jpg',
          info: { logo_url: 'https://example.com/logo.png' },
        },
        {
          id: 'band-2',
          name: 'The Rollers',
          order: 2,
          company_name: undefined,
          hero_thumbnail_url: undefined,
          info: undefined,
        },
      ],
    })
  })

  it.each(['upcoming', 'closed', 'locked', 'finalized', 'archived'])(
    'says voting is not open when the event is %s',
    async (status) => {
      mockGetEventById.mockResolvedValue(event(status))
      const ballot = await getBallot('sydney-2026')
      expect(ballot?.event.votingOpen).toBe(false)
      expect(ballot?.event.status).toBe(status)
    }
  )

  it('returns null for an unknown event without loading bands', async () => {
    mockGetEventById.mockResolvedValue(NO_EVENT)
    expect(await getBallot('nope')).toBeNull()
    expect(mockGetBandsForEvent).not.toHaveBeenCalled()
  })

  describe('cache', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-10-08T09:00:00Z'))
    })

    it('answers a second call within 2 seconds from memory', async () => {
      mockGetEventById.mockResolvedValue(event('voting'))
      const first = await getBallot('sydney-2026')
      vi.advanceTimersByTime(1999)
      mockGetEventById.mockResolvedValue(event('closed'))
      const second = await getBallot('sydney-2026')

      expect(mockGetEventById).toHaveBeenCalledTimes(1)
      expect(mockGetBandsForEvent).toHaveBeenCalledTimes(1)
      expect(second).toEqual(first)
      expect(second?.event.votingOpen).toBe(true)
    })

    it('reads the database again after 2 seconds, so closing voting reaches phones', async () => {
      mockGetEventById.mockResolvedValue(event('voting'))
      await getBallot('sydney-2026')
      vi.advanceTimersByTime(2000)
      mockGetEventById.mockResolvedValue(event('closed'))
      const later = await getBallot('sydney-2026')

      expect(mockGetEventById).toHaveBeenCalledTimes(2)
      expect(later?.event.votingOpen).toBe(false)
    })

    it('caches per event', async () => {
      mockGetEventById.mockImplementation(async (id: string) =>
        event('voting', { id, name: id })
      )
      const a = await getBallot('event-a')
      const b = await getBallot('event-b')
      expect(a?.event.id).toBe('event-a')
      expect(b?.event.id).toBe('event-b')
      expect(mockGetEventById).toHaveBeenCalledTimes(2)
    })

    it('caches "not found" for the same 2 seconds', async () => {
      mockGetEventById.mockResolvedValue(NO_EVENT)
      await getBallot('nope')
      await getBallot('nope')
      expect(mockGetEventById).toHaveBeenCalledTimes(1)
    })

    describe('bounded size (the route is public, so ids can be made up)', () => {
      const lookups = (id: string) =>
        mockGetEventById.mock.calls.filter(([called]) => called === id).length

      beforeEach(() => {
        mockGetEventById.mockImplementation(async (id: string) =>
          id === 'sydney-2026' ? event('voting') : NO_EVENT
        )
      })

      it('keeps a real event cached while filling up to the cap', async () => {
        await getBallot('sydney-2026')
        for (let i = 0; i < 98; i++) await getBallot(`made-up-${i}`)
        await getBallot('sydney-2026')
        expect(lookups('sydney-2026')).toBe(1)
      })

      it('empties itself rather than grow past 100 live entries', async () => {
        await getBallot('first')
        for (let i = 0; i < 149; i++) await getBallot(`made-up-${i}`)
        // Still inside the 2 seconds, but "first" was dropped when the cache
        // filled, so it is read again.
        await getBallot('first')
        expect(lookups('first')).toBe(2)
        // And the cache works again afterwards.
        await getBallot('made-up-148')
        expect(lookups('made-up-148')).toBe(1)
      })

      it('drops expired entries first, keeping the fresh ones', async () => {
        for (let i = 0; i < 60; i++) await getBallot(`old-${i}`)
        vi.advanceTimersByTime(2500)
        await getBallot('sydney-2026')
        for (let i = 0; i < 39; i++) await getBallot(`new-${i}`)
        // 100 entries now, 60 of them expired: the next one prunes those.
        await getBallot('one-more')
        await getBallot('sydney-2026')
        expect(lookups('sydney-2026')).toBe(1)
      })

      it('copes with 150 distinct unknown ids without throwing', async () => {
        for (let i = 0; i < 150; i++) {
          await expect(getBallot(`unknown-${i}`)).resolves.toBeNull()
        }
      })
    })

    it('starts empty again after clearBallotCache', async () => {
      mockGetEventById.mockResolvedValue(event('voting'))
      await getBallot('sydney-2026')
      clearBallotCache()
      await getBallot('sydney-2026')
      expect(mockGetEventById).toHaveBeenCalledTimes(2)
    })
  })
})
