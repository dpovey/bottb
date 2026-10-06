import { vi } from 'vitest'

// Mock the auth function - must be hoisted
const mockAuth = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}))

import { NextResponse } from 'next/server'
import {
  withAdminAuth,
  withAuth,
  withRateLimit,
  withAdminProtection,
  withUserProtection,
  withPublicRateLimit,
  withVoteRateLimit,
  clearRateLimitStore,
} from '../api-protection'
import { createMockRequest } from '../../__tests__/utils/api-test-helpers'

describe('API Protection System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearRateLimitStore()
  })

  describe('withAdminAuth', () => {
    it('allows admin users', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: 'admin-1',
          email: 'admin@test.com',
          isAdmin: true,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })

      const handler = withAdminAuth(async (_request, _context, session) => {
        return NextResponse.json({ success: true, userId: session?.user.id })
      })

      const request = createMockRequest('http://localhost/api/test')
      const response = await handler(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.userId).toBe('admin-1')
    })

    it('blocks non-admin users', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: 'user-1',
          email: 'user@test.com',
          isAdmin: false,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })

      const handler = withAdminAuth(async () => {
        return NextResponse.json(
          { error: 'Should not reach here' },
          { status: 200 }
        )
      })

      const request = createMockRequest('http://localhost/api/test')
      const response = await handler(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized - Admin access required')
    })

    it('blocks unauthenticated users', async () => {
      mockAuth.mockResolvedValue(null)

      const handler = withAdminAuth(async () => {
        return NextResponse.json(
          { error: 'Should not reach here' },
          { status: 200 }
        )
      })

      const request = createMockRequest('http://localhost/api/test')
      const response = await handler(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized - Admin access required')
    })
  })

  describe('withAuth', () => {
    it('allows authenticated users', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: 'user-1',
          email: 'user@test.com',
          isAdmin: false,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })

      const handler = withAuth(async (_request, _context, session) => {
        return NextResponse.json({ success: true, userId: session?.user.id })
      })

      const request = createMockRequest('http://localhost/api/test')
      const response = await handler(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.userId).toBe('user-1')
    })

    it('blocks unauthenticated users', async () => {
      mockAuth.mockResolvedValue(null)

      const handler = withAuth(async () => {
        return NextResponse.json(
          { error: 'Should not reach here' },
          { status: 200 }
        )
      })

      const request = createMockRequest('http://localhost/api/test')
      const response = await handler(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized - Authentication required')
    })
  })

  describe('withRateLimit', () => {
    it('allows requests within limit', async () => {
      const handler = withRateLimit(async () => {
        return NextResponse.json({ success: true })
      }, 'api')

      const request = createMockRequest('http://localhost/api/test')
      const response = await handler(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it('blocks requests exceeding limit', async () => {
      const handler = withRateLimit(async () => {
        return NextResponse.json({ success: true })
      }, 'api')

      // Make 101 requests (exceeding the 100/min limit)
      const requests = Array.from({ length: 101 }, (_, _i) =>
        createMockRequest('http://localhost/api/test', {
          headers: {
            'X-Forwarded-For': '192.168.1.1',
            'User-Agent': 'TestAgent',
          },
        })
      )

      const responses = await Promise.all(requests.map((req) => handler(req)))

      const lastResponse = responses[responses.length - 1]
      expect(lastResponse.status).toBe(429)

      const data = await lastResponse.json()
      expect(data.error).toBe('Too many requests')
      expect(data.limit).toBe(100)
      expect(data.retryAfter).toBeDefined()
    })

    it('uses different limits for different types', async () => {
      const ok = async () => NextResponse.json({ success: true })
      const voteHandler = withRateLimit(ok, 'vote')
      const photoHandler = withRateLimit(ok, 'photo')
      const request = (ip: string) =>
        createMockRequest('http://localhost/api/test', {
          headers: { 'X-Forwarded-For': ip, 'User-Agent': 'TestAgent' },
        })

      // 21 photo requests: the 21st is over the photo limit (20/min)
      const photoResponses = await Promise.all(
        Array.from({ length: 21 }, () => photoHandler(request('192.168.1.1')))
      )
      expect(photoResponses[19].status).toBe(200)
      expect(photoResponses[20].status).toBe(429)
      expect((await photoResponses[20].json()).limit).toBe(20)

      // 21 vote requests from another client are all fine (300/min)
      const voteResponses = await Promise.all(
        Array.from({ length: 21 }, () => voteHandler(request('192.168.1.2')))
      )
      expect(voteResponses.every((r) => r.status === 200)).toBe(true)
    })
  })

  describe('separate counters per limit type', () => {
    const ok = async () => NextResponse.json({ success: true })
    const sameClient = () =>
      createMockRequest('http://localhost/api/test', {
        headers: {
          'X-Forwarded-For': '192.168.1.9',
          'User-Agent': 'TestAgent',
        },
      })

    it('does not block api requests from a client that has used up its votes', async () => {
      const voteHandler = withVoteRateLimit(ok)
      const apiHandler = withPublicRateLimit(ok)

      const votes = await Promise.all(
        Array.from({ length: 301 }, () => voteHandler(sameClient()))
      )
      expect(votes[300].status).toBe(429)

      const api = await apiHandler(sameClient())
      expect(api.status).toBe(200)
      expect(api.headers.get('X-RateLimit-Limit')).toBe('100')
      expect(api.headers.get('X-RateLimit-Remaining')).toBe('99')
    })

    it('does not block votes from a client that has used up its api requests', async () => {
      const voteHandler = withVoteRateLimit(ok)
      const apiHandler = withPublicRateLimit(ok)

      const api = await Promise.all(
        Array.from({ length: 101 }, () => apiHandler(sameClient()))
      )
      expect(api[100].status).toBe(429)

      const vote = await voteHandler(sameClient())
      expect(vote.status).toBe(200)
      expect(vote.headers.get('X-RateLimit-Remaining')).toBe('299')
    })

    it('still shares one counter between handlers of the same type', async () => {
      const first = withPublicRateLimit(ok)
      const second = withPublicRateLimit(ok)

      await Promise.all(Array.from({ length: 100 }, () => first(sameClient())))

      expect((await second(sameClient())).status).toBe(429)
    })
  })

  describe('withAdminProtection', () => {
    it('combines admin auth and rate limiting', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: 'admin-1',
          email: 'admin@test.com',
          isAdmin: true,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })

      const handler = withAdminProtection(
        async (_request, _context, _session) => {
          return NextResponse.json({ success: true })
        }
      )

      const request = createMockRequest('http://localhost/api/test')
      const response = await handler(request)

      expect(response.status).toBe(200)
    })

    it('blocks non-admin users even with rate limiting', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: 'user-1',
          email: 'user@test.com',
          isAdmin: false,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })

      const handler = withAdminProtection(async () => {
        return NextResponse.json(
          { error: 'Should not reach here' },
          { status: 200 }
        )
      })

      const request = createMockRequest('http://localhost/api/test')
      const response = await handler(request)

      expect(response.status).toBe(401)
    })
  })

  describe('withUserProtection', () => {
    it('combines user auth and rate limiting', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: 'user-1',
          email: 'user@test.com',
          isAdmin: false,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })

      const handler = withUserProtection(
        async (_request, _context, _session) => {
          return NextResponse.json({ success: true })
        }
      )

      const request = createMockRequest('http://localhost/api/test')
      const response = await handler(request)

      expect(response.status).toBe(200)
    })
  })

  describe('withPublicRateLimit', () => {
    it('applies rate limiting to public endpoints', async () => {
      const handler = withPublicRateLimit(async () => {
        return NextResponse.json({ success: true })
      })

      const request = createMockRequest('http://localhost/api/test')
      const response = await handler(request)

      expect(response.status).toBe(200)
    })
  })

  describe('withVoteRateLimit', () => {
    // A venue's Wi-Fi puts a whole crowd of identical phones behind one
    // address, so the vote limit has to leave room for them.
    it('lets 300 votes a minute through from one address and browser', async () => {
      const handler = withVoteRateLimit(async () => {
        return NextResponse.json({ success: true })
      })

      // 301 requests: the first 300 pass, the 121st is over the limit
      const requests = Array.from({ length: 301 }, (_, _i) =>
        createMockRequest('http://localhost/api/votes', {
          headers: {
            'X-Forwarded-For': '192.168.1.1',
            'User-Agent': 'TestAgent',
          },
        })
      )

      const responses = await Promise.all(requests.map((req) => handler(req)))

      expect(responses.slice(0, 300).every((r) => r.status === 200)).toBe(true)
      const lastResponse = responses[responses.length - 1]
      expect(lastResponse.status).toBe(429)

      const data = await lastResponse.json()
      expect(data.limit).toBe(300)
      expect(data.windowMs).toBe(60_000)
    })
  })

  describe('Rate limit headers', () => {
    beforeEach(() => {
      clearRateLimitStore()
    })

    it('includes proper rate limit headers on rate limited responses', async () => {
      const handler = withRateLimit(async () => {
        return NextResponse.json({ success: true })
      }, 'api')

      // Make 101 requests with the same client identifier to trigger rate limit
      const requests = Array.from({ length: 101 }, () =>
        createMockRequest('http://localhost/api/test', {
          headers: {
            'X-Forwarded-For': '192.168.1.1',
            'User-Agent': 'TestAgent',
          },
        })
      )

      const responses = await Promise.all(requests.map((req) => handler(req)))
      const lastResponse = responses[responses.length - 1]

      expect(lastResponse.status).toBe(429)
      expect(lastResponse.headers.get('X-RateLimit-Limit')).toBe('100')
      expect(lastResponse.headers.get('X-RateLimit-Remaining')).toBe('0')
    })

    it('includes retry-after header when rate limited', async () => {
      const handler = withRateLimit(async () => {
        return NextResponse.json({ success: true })
      }, 'api')

      // Make 101 requests to trigger rate limit
      const requests = Array.from({ length: 101 }, (_, _i) =>
        createMockRequest('http://localhost/api/test', {
          headers: {
            'X-Forwarded-For': '192.168.1.1',
            'User-Agent': 'TestAgent',
          },
        })
      )

      const responses = await Promise.all(requests.map((req) => handler(req)))

      const lastResponse = responses[responses.length - 1]
      expect(lastResponse.status).toBe(429)
      expect(lastResponse.headers.get('Retry-After')).toBeDefined()
      expect(lastResponse.headers.get('X-RateLimit-Limit')).toBe('100')
      expect(lastResponse.headers.get('X-RateLimit-Remaining')).toBe('0')
    })
  })
})
