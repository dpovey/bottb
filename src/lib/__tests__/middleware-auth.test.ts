import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mockGetToken = vi.hoisted(() => vi.fn())
vi.mock('next-auth/jwt', () => ({
  getToken: mockGetToken,
}))

import { getMiddlewareSession, isAdminUser } from '../middleware-auth'

/**
 * Build a minimal NextRequest stub. The middleware code only touches
 * `headers.get(...)`, so a Headers instance is enough.
 */
function buildRequest(headers: Record<string, string> = {}): NextRequest {
  const h = new Headers(headers)
  return {
    headers: h,
  } as unknown as NextRequest
}

beforeEach(() => {
  mockGetToken.mockReset()
  vi.stubEnv('AUTH_SECRET', 'test-secret')
  vi.stubEnv('NODE_ENV', 'test')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('middleware-auth', () => {
  describe('getMiddlewareSession', () => {
    it('returns null when no token is found', async () => {
      mockGetToken.mockResolvedValueOnce(null)
      const session = await getMiddlewareSession(buildRequest())
      expect(session).toBeNull()
    })

    it('returns a normalized session shape when a token is present', async () => {
      mockGetToken.mockResolvedValueOnce({
        sub: 'user-42',
        email: 'admin@example.com',
        name: 'Admin',
        isAdmin: true,
      })
      const session = await getMiddlewareSession(buildRequest())
      expect(session).toEqual({
        user: {
          id: 'user-42',
          email: 'admin@example.com',
          name: 'Admin',
          isAdmin: true,
        },
      })
    })

    it('uses the dev cookie name when not in production and not HTTPS', async () => {
      vi.stubEnv('NODE_ENV', 'test')
      mockGetToken.mockResolvedValueOnce(null)
      await getMiddlewareSession(buildRequest())
      const call = mockGetToken.mock.calls[0]?.[0] as { cookieName?: string }
      expect(call.cookieName).toBe('authjs.session-token')
    })

    it('uses the __Secure- cookie when in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      mockGetToken.mockResolvedValueOnce(null)
      await getMiddlewareSession(buildRequest())
      const call = mockGetToken.mock.calls[0]?.[0] as { cookieName?: string }
      expect(call.cookieName).toBe('__Secure-authjs.session-token')
      logSpy.mockRestore()
    })

    it('uses the __Secure- cookie when behind HTTPS via x-forwarded-proto', async () => {
      vi.stubEnv('NODE_ENV', 'test')
      mockGetToken.mockResolvedValueOnce(null)
      await getMiddlewareSession(buildRequest({ 'x-forwarded-proto': 'https' }))
      const call = mockGetToken.mock.calls[0]?.[0] as { cookieName?: string }
      expect(call.cookieName).toBe('__Secure-authjs.session-token')
    })

    it('passes the AUTH_SECRET to getToken', async () => {
      vi.stubEnv('AUTH_SECRET', 'super-secret')
      mockGetToken.mockResolvedValueOnce(null)
      await getMiddlewareSession(buildRequest())
      const call = mockGetToken.mock.calls[0]?.[0] as { secret?: string }
      expect(call.secret).toBe('super-secret')
    })

    it('returns null and does not throw when getToken throws', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetToken.mockRejectedValueOnce(new Error('jwt blew up'))
      const session = await getMiddlewareSession(buildRequest())
      expect(session).toBeNull()
      errSpy.mockRestore()
    })

    it('coerces isAdmin to boolean from the token', async () => {
      mockGetToken.mockResolvedValueOnce({
        sub: 'user-1',
        email: 'a@b.com',
        name: null,
        isAdmin: false,
      })
      const session = await getMiddlewareSession(buildRequest())
      expect(session?.user.isAdmin).toBe(false)
    })
  })

  describe('isAdminUser', () => {
    it('returns false when there is no session', async () => {
      mockGetToken.mockResolvedValueOnce(null)
      await expect(isAdminUser(buildRequest())).resolves.toBe(false)
    })

    it('returns false when the session user is not an admin', async () => {
      mockGetToken.mockResolvedValueOnce({
        sub: 'user-1',
        email: 'a@b.com',
        name: 'A',
        isAdmin: false,
      })
      await expect(isAdminUser(buildRequest())).resolves.toBe(false)
    })

    it('returns true when the session user is an admin', async () => {
      mockGetToken.mockResolvedValueOnce({
        sub: 'user-1',
        email: 'a@b.com',
        name: 'A',
        isAdmin: true,
      })
      await expect(isAdminUser(buildRequest())).resolves.toBe(true)
    })

    it('returns false when getToken throws', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetToken.mockRejectedValueOnce(new Error('boom'))
      await expect(isAdminUser(buildRequest())).resolves.toBe(false)
      errSpy.mockRestore()
    })
  })
})
