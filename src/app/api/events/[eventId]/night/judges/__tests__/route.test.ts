// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import type { ProtectedApiHandler } from '@/lib/api-protection'

vi.mock('@/lib/api-protection', () => ({
  withAdminProtection: (handler: ProtectedApiHandler) => handler,
}))

vi.mock('@/lib/db', () => ({
  getEventById: vi.fn(),
}))

vi.mock('@/lib/db/night', () => ({
  deleteJudgeSheet: vi.fn(),
}))

vi.mock('@/lib/night', () => ({
  getNightState: vi.fn(),
}))

import { getEventById } from '@/lib/db'
import { deleteJudgeSheet } from '@/lib/db/night'
import type { Event } from '@/lib/db-types'
import { getNightState } from '@/lib/night'
import type { NightState } from '@/lib/night-types'
import { DELETE } from '../route'

/** getEventById is typed as always finding the event, but returns null when it does not. */
const NO_EVENT = null as unknown as Event

const mockGetEventById = vi.mocked(getEventById)
const mockDelete = vi.mocked(deleteJudgeSheet)
const mockGetNightState = vi.mocked(getNightState)

const EVENT_ID = 'sydney-2026'
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

async function del(body: unknown) {
  const request = {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest
  const response = await DELETE(request, {
    params: Promise.resolve({ eventId: EVENT_ID }),
  })
  return { status: response.status, body: await response.json() }
}

describe('DELETE /api/events/[eventId]/night/judges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockGetEventById.mockResolvedValue(event('closed'))
    mockGetNightState.mockResolvedValue(state)
    mockDelete.mockResolvedValue(5)
  })

  it.each([
    ['no name', {}],
    ['a blank name', { name: '   ' }],
    ['a non-string name', { name: 7 }],
    ['no body', null],
  ])('answers 400 for %s', async (_label, body) => {
    const { status, body: data } = await del(body)
    expect(status).toBe(400)
    expect(data).toEqual({ error: 'Judge name is required' })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('answers 404 for an unknown event', async () => {
    mockGetEventById.mockResolvedValue(NO_EVENT)
    const { status } = await del({ name: 'Ann' })
    expect(status).toBe(404)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it.each(['locked', 'finalized', 'archived'])(
    'refuses with 409 once the event is %s',
    async (eventStatus) => {
      mockGetEventById.mockResolvedValue(event(eventStatus))
      const { status, body } = await del({ name: 'Ann' })
      expect(status).toBe(409)
      expect(body.error).toContain('Judge scores cannot be changed')
      expect(body.error).toContain('Unlock the results first.')
      expect(body.state).toEqual(state)
      expect(mockDelete).not.toHaveBeenCalled()
    }
  )

  it.each(['upcoming', 'voting', 'closed'])(
    'deletes the sheet while the event is %s',
    async (eventStatus) => {
      mockGetEventById.mockResolvedValue(event(eventStatus))
      const { status, body } = await del({ name: 'Ann' })
      expect(status).toBe(200)
      expect(body).toEqual({ deleted: 5, state })
      expect(mockDelete).toHaveBeenCalledWith(EVENT_ID, 'Ann')
    }
  )

  it('trims the judge name', async () => {
    await del({ name: '  Ann Smith  ' })
    expect(mockDelete).toHaveBeenCalledWith(EVENT_ID, 'Ann Smith')
  })

  it('answers 404 with the state when that judge has no scores', async () => {
    mockDelete.mockResolvedValue(0)
    const { status, body } = await del({ name: 'Nobody' })
    expect(status).toBe(404)
    expect(body).toEqual({
      error: 'No scores found for judge "Nobody".',
      state,
    })
  })

  it('answers 500 when the delete fails', async () => {
    mockDelete.mockRejectedValue(new Error('db down'))
    const { status, body } = await del({ name: 'Ann' })
    expect(status).toBe(500)
    expect(body).toEqual({ error: 'Failed to delete the judge scores' })
  })
})
