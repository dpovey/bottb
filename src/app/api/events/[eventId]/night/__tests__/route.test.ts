// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import type { ProtectedApiHandler } from '@/lib/api-protection'

// The real NextResponse, so the response headers can be checked.
vi.mock('next/server', async () => await vi.importActual('next/server'))

vi.mock('@/lib/api-protection', () => ({
  withAdminProtection: (handler: ProtectedApiHandler) => handler,
}))

vi.mock('@/lib/night', () => ({
  getNightState: vi.fn(),
}))

import { getNightState } from '@/lib/night'
import type { NightState } from '@/lib/night-types'
import { GET } from '../route'

const mockGetNightState = vi.mocked(getNightState)
const EVENT_ID = 'sydney-2026'

const state = {
  event: { id: EVENT_ID, status: 'voting' },
  generatedAt: '2026-10-08T10:00:00.000Z',
} as unknown as NightState

async function get() {
  return GET({} as NextRequest, {
    params: Promise.resolve({ eventId: EVENT_ID }),
  })
}

describe('GET /api/events/[eventId]/night', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns the state, never cached', async () => {
    mockGetNightState.mockResolvedValue(state)
    const response = await get()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(state)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(mockGetNightState).toHaveBeenCalledWith(EVENT_ID)
  })

  it('answers 404 for an unknown event', async () => {
    mockGetNightState.mockResolvedValue(null)
    const response = await get()
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Event not found' })
  })

  it('answers 500 when the state cannot be built', async () => {
    mockGetNightState.mockRejectedValue(new Error('db down'))
    const response = await get()
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Failed to load the event state',
    })
  })
})
