import { NextRequest } from 'next/server'
import { POST } from '../route'
import { bulkSetPhotosVisibility } from '@/lib/db'
import { auth } from '@/lib/auth'
import { clearRateLimitStore } from '@/lib/api-protection'
import { vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  bulkSetPhotosVisibility: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

const mockBulkSet = bulkSetPhotosVisibility as ReturnType<typeof vi.fn>
const mockAuth = auth as ReturnType<typeof vi.fn>

function postRequest(body: unknown) {
  const request = new NextRequest(
    'http://localhost/api/admin/photos/visibility',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  )
  // The test environment doesn't parse the request body, so stub json().
  request.json = vi.fn().mockResolvedValue(body)
  return request
}

describe('POST /api/admin/photos/visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearRateLimitStore()
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', isAdmin: true } })
  })

  it('releases all photos for an event to public', async () => {
    mockBulkSet.mockResolvedValue(12)

    const response = await POST(
      postRequest({ visibility: 'public', eventId: 'event-1' }),
      undefined
    )

    expect(mockBulkSet).toHaveBeenCalledWith(
      { eventId: 'event-1', photographer: undefined },
      'public'
    )
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toMatchObject({
      success: true,
      updated: 12,
      visibility: 'public',
    })
  })

  it('scopes by photographer', async () => {
    mockBulkSet.mockResolvedValue(3)

    const response = await POST(
      postRequest({ visibility: 'private', photographer: 'Jane Doe' }),
      undefined
    )

    expect(mockBulkSet).toHaveBeenCalledWith(
      { eventId: undefined, photographer: 'Jane Doe' },
      'private'
    )
    expect(response.status).toBe(200)
  })

  it('rejects an invalid visibility value', async () => {
    const response = await POST(
      postRequest({ visibility: 'sometimes', eventId: 'event-1' }),
      undefined
    )

    expect(response.status).toBe(400)
    expect(mockBulkSet).not.toHaveBeenCalled()
  })

  it('rejects a request with no scope', async () => {
    const response = await POST(
      postRequest({ visibility: 'public' }),
      undefined
    )

    expect(response.status).toBe(400)
    expect(mockBulkSet).not.toHaveBeenCalled()
  })

  it('rejects a non-admin', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1', isAdmin: false } })

    const response = await POST(
      postRequest({ visibility: 'public', eventId: 'event-1' }),
      undefined
    )

    expect(response.status).toBe(401)
    expect(mockBulkSet).not.toHaveBeenCalled()
  })
})
