// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import type { ProtectedApiHandler } from '@/lib/api-protection'

vi.mock('@/lib/api-protection', () => ({
  withAdminProtection: (handler: ProtectedApiHandler) => handler,
}))

vi.mock('@/lib/db/night', () => ({
  ensureTestEvent: vi.fn(),
}))

import { ensureTestEvent } from '@/lib/db/night'
import type { Event } from '@/lib/db-types'
import { POST } from '../route'

const mockEnsure = vi.mocked(ensureTestEvent)

const testEvent = {
  id: 'test-night',
  name: 'Test Night (rehearsal)',
  is_test: true,
  status: 'upcoming',
} as Event

describe('POST /api/admin/test-event', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('creates (or returns) the rehearsal event with the current scoring version', async () => {
    mockEnsure.mockResolvedValue(testEvent)
    const response = await POST({} as NextRequest)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ event: testEvent })
    expect(mockEnsure).toHaveBeenCalledWith('2026.2')
  })

  it('answers 500 when the id belongs to a real event', async () => {
    mockEnsure.mockRejectedValue(
      new Error('Event "test-night" exists and is not a test event')
    )
    const response = await POST({} as NextRequest)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Failed to create the test event',
    })
  })
})
