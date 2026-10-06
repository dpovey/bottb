// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// The real NextResponse, so the response headers can be checked.
vi.mock('next/server', async () => await vi.importActual('next/server'))

vi.mock('@/lib/ballot', () => ({
  getBallot: vi.fn(),
}))

import { getBallot, type Ballot } from '@/lib/ballot'
import { GET } from '../route'

const mockGetBallot = vi.mocked(getBallot)

const ballot: Ballot = {
  event: {
    id: 'sydney-2026',
    name: 'Sydney 2026',
    status: 'voting',
    votingOpen: true,
  },
  bands: [{ id: 'b1', name: 'The Rockers', order: 1 }],
}

async function get(eventId = 'sydney-2026') {
  return GET({} as NextRequest, { params: Promise.resolve({ eventId }) })
}

describe('GET /api/events/[eventId]/ballot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns the ballot with a short CDN cache', async () => {
    mockGetBallot.mockResolvedValue(ballot)
    const response = await get()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(ballot)
    expect(mockGetBallot).toHaveBeenCalledWith('sydney-2026')

    const cacheControl = response.headers.get('Cache-Control') ?? ''
    expect(cacheControl).toMatch(/\bs-maxage=\d+/)
    expect(cacheControl).toContain('public')
    // Browsers must not hold on to it: opening and closing voting has to
    // reach every phone within seconds.
    expect(cacheControl).toContain('max-age=0')
    const sMaxAge = Number(/s-maxage=(\d+)/.exec(cacheControl)?.[1])
    expect(sMaxAge).toBeLessThanOrEqual(5)
  })

  it('answers 404 for an unknown event and is not cached', async () => {
    mockGetBallot.mockResolvedValue(null)
    const response = await get('nope')
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Event not found' })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('answers 500 when the ballot cannot be loaded and is not cached', async () => {
    mockGetBallot.mockRejectedValue(new Error('db down'))
    const response = await get()
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Failed to load the ballot',
    })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})
