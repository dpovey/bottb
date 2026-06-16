import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../route'

// Rate-limit wrapper is a passthrough in tests.
vi.mock('@/lib/api-protection', () => ({
  withRateLimit: (handler: unknown) => handler,
}))

// Auth + cache are mocked so we can assert behaviour without a session/runtime.
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>

function makeRequest(
  body: Record<string, unknown> | null,
  headers: Record<string, string> = {}
) {
  return {
    headers: new Headers({ 'content-type': 'application/json', ...headers }),
    json: vi
      .fn()
      .mockImplementation(() =>
        body === null
          ? Promise.reject(new Error('no body'))
          : Promise.resolve(body)
      ),
  } as unknown as NextRequest
}

describe('POST /api/admin/revalidate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedAuth.mockResolvedValue(null)
    delete process.env.REVALIDATE_SECRET
    process.env.AUTH_SECRET = 'test-secret'
  })

  it('rejects unauthenticated requests', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(401)
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('refreshes the default public set for an admin session', async () => {
    mockedAuth.mockResolvedValue({ user: { isAdmin: true } })

    const res = await POST(makeRequest({}))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(revalidatePath).toHaveBeenCalledWith('/')
    expect(revalidatePath).toHaveBeenCalledWith('/events')
    expect(revalidateTag).toHaveBeenCalledWith('nav-events', 'fiveMinutes')
  })

  it('accepts a matching bearer secret (CLI caller)', async () => {
    const res = await POST(
      makeRequest({}, { authorization: 'Bearer test-secret' })
    )
    expect(res.status).toBe(200)
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('rejects a wrong bearer secret', async () => {
    const res = await POST(makeRequest({}, { authorization: 'Bearer nope' }))
    expect(res.status).toBe(401)
  })

  it('honours explicit paths/tags in the body', async () => {
    mockedAuth.mockResolvedValue({ user: { isAdmin: true } })

    const res = await POST(
      makeRequest({ paths: ['/event/brisbane-2026'], tags: ['photos'] })
    )

    expect(res.status).toBe(200)
    expect(revalidatePath).toHaveBeenCalledWith('/event/brisbane-2026')
    expect(revalidateTag).toHaveBeenCalledWith('photos', 'fifteenMinutes')
    // Defaults are replaced, not merged.
    expect(revalidatePath).not.toHaveBeenCalledWith('/')
  })
})
