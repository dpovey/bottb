import { NextRequest } from 'next/server'
import { GET } from '../route'
import { getEventById } from '@/lib/db'
import { vi } from 'vitest'

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
        mockGetEventById as unknown as jest.MockedFunction<
          (eventId: string) => Promise<import('@/lib/db').Event | null>
        >
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
})
