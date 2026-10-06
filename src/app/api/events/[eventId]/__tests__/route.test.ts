import { NextRequest } from 'next/server'
import { GET, PATCH } from '../route'
import { getEventById } from '@/lib/db'
import { sql } from '@/lib/sql'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiHandler } from '@/lib/api-protection'

vi.mock('@/lib/sql', () => ({ sql: vi.fn(), sqlQuery: vi.fn() }))

// Rate limiting and admin auth are tested elsewhere; pass straight through.
vi.mock('@/lib/api-protection', () => ({
  withPublicRateLimit: (handler: ApiHandler) => handler,
  withAdminProtection: (handler: ApiHandler) => handler,
}))

// Mock the database function
vi.mock('@/lib/db', () => ({
  getEventById: vi.fn(),
}))

const mockGetEventById = getEventById as ReturnType<typeof vi.fn>

describe('/api/events/[eventId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('returns event when found', async () => {
      const eventId = 'event-1'
      const mockEvent = {
        id: eventId,
        name: 'Test Event',
        date: '2024-12-25T18:30:00Z',
        location: 'Test Venue',
        is_active: true,
        status: 'voting' as const,
        created_at: '2024-01-01T00:00:00Z',
      }

      mockGetEventById.mockResolvedValue(mockEvent)

      const request = new NextRequest(`http://localhost/api/events/${eventId}`)
      const response = await GET(request, {
        params: Promise.resolve({ eventId }),
      })

      expect(mockGetEventById).toHaveBeenCalledWith(eventId)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toEqual(mockEvent)
    })

    it('returns 404 when event not found', async () => {
      const eventId = 'nonexistent-event'
      ;(
        mockGetEventById as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null)

      const request = new NextRequest(`http://localhost/api/events/${eventId}`)
      const response = await GET(request, {
        params: Promise.resolve({ eventId }),
      })

      expect(response.status).toBe(404)

      const data = await response.json()
      expect(data).toEqual({ error: 'Event not found' })
    })

    it('returns 500 when database error occurs', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const eventId = 'event-1'
      mockGetEventById.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest(`http://localhost/api/events/${eventId}`)
      const response = await GET(request, {
        params: Promise.resolve({ eventId }),
      })

      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data).toEqual({ error: 'Internal server error' })

      // Assert that console.error was called with the expected error
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching event:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('PATCH', () => {
    const eventId = 'event-1'
    const existing = {
      id: eventId,
      name: 'Test Event',
      date: '2024-12-25T18:30:00Z',
      location: 'Test Venue',
      timezone: 'Australia/Sydney',
      is_active: true,
      status: 'voting' as const,
      created_at: '2024-01-01T00:00:00Z',
      description: null,
      info: {},
    }

    function patchRequest(body: unknown): NextRequest {
      return {
        url: `http://localhost/api/events/${eventId}`,
        json: vi.fn().mockResolvedValue(body),
      } as unknown as NextRequest
    }

    beforeEach(() => {
      mockGetEventById.mockResolvedValue(existing)
      vi.mocked(sql).mockResolvedValue({
        rows: [{ ...existing, name: 'Renamed' }],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as never)
    })

    it('ignores a status in the body: only the lifecycle steps change it', async () => {
      const response = await PATCH(
        patchRequest({ name: 'Renamed', status: 'finalized' })
      )
      expect(response.status).toBe(200)

      expect(sql).toHaveBeenCalledTimes(1)
      const [strings, ...values] = vi.mocked(sql).mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ]
      const text = strings.join('$')
      expect(text).toContain('UPDATE events SET')
      expect(text).not.toMatch(/\bstatus\b/)
      expect(text).not.toMatch(/\bis_active\b/)
      expect(values).not.toContain('finalized')
      expect(values).toContain('Renamed')
    })

    it('answers 404 for an unknown event without updating', async () => {
      mockGetEventById.mockResolvedValue(null)
      const response = await PATCH(patchRequest({ status: 'finalized' }))
      expect(response.status).toBe(404)
      expect(sql).not.toHaveBeenCalled()
    })
  })
})
