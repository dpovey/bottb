import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest'
import { NextRequest } from 'next/server'
import { createRequest } from 'node-mocks-http'
import { PATCH } from '../route'
import { Event } from '@/lib/db'

// Mock the database function
vi.mock('@/lib/db', () => ({
  updateEventStatus: vi.fn(),
}))

// Mock the API protection
vi.mock('@/lib/api-protection', () => ({
  withAdminProtection: (
    handler: (
      request: NextRequest,
      context?: { params?: { eventId: string } }
    ) => Promise<Response>
  ) => handler,
}))

// Mock revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { updateEventStatus } from '@/lib/db'

// Helper function to create NextRequest mock
function createNextRequestMock(
  bodyData: Record<string, unknown>,
  headers: Record<string, string> = {}
) {
  const request = createRequest({
    method: 'PATCH',
    url: 'http://localhost:3000/api/events/test-event-1/status',
    body: bodyData,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })

  // Add required NextRequest properties
  request.json = vi.fn().mockResolvedValue(bodyData)

  return request as unknown as NextRequest
}

describe('/api/events/[eventId]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update event status successfully', async () => {
    const mockEvent = {
      id: 'test-event-1',
      name: 'Test Event',
      location: 'Test Location',
      timezone: 'Australia/Brisbane',
      status: 'voting' as const,
      date: '2024-01-01',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
    }

    vi.mocked(updateEventStatus).mockResolvedValue(mockEvent)

    const request = createNextRequestMock({ status: 'voting' })

    const response = await PATCH(request, {})
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toBe('Event status updated to voting')
    expect(data.event).toEqual(mockEvent)
    expect(updateEventStatus).toHaveBeenCalledWith('test-event-1', 'voting')
  })

  it('should return 400 for invalid status', async () => {
    const request = createNextRequestMock({ status: 'invalid-status' })

    const response = await PATCH(request, {})
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe(
      "Invalid status. Must be 'upcoming', 'voting', or 'finalized'"
    )
  })

  it('should return 400 for missing status', async () => {
    const request = createNextRequestMock({})

    const response = await PATCH(request, {})
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe(
      "Invalid status. Must be 'upcoming', 'voting', or 'finalized'"
    )
  })

  it('should return 404 when event not found', async () => {
    ;(
      vi.mocked(updateEventStatus) as MockedFunction<
        (eventId: string, status: string) => Promise<Event | null>
      >
    ).mockResolvedValue(null)

    const request = createNextRequestMock({ status: 'voting' })

    const response = await PATCH(request, {})
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Event not found')
  })

  it('should handle database errors', async () => {
    vi.mocked(updateEventStatus).mockRejectedValue(new Error('Database error'))

    const request = createNextRequestMock({ status: 'voting' })

    const response = await PATCH(request, {})
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to update event status')
  })
})
