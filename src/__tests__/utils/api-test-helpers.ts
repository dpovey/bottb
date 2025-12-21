import { NextRequest, NextResponse } from 'next/server'
import { Session } from 'next-auth'
import { vi } from 'vitest'

// Mock the auth function
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import { auth } from '@/lib/auth'
const mockAuth = auth as ReturnType<typeof vi.fn>

/**
 * Test helper to create a mock NextRequest
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
    cookies?: Record<string, string>
  } = {}
): NextRequest {
  const { method = 'GET', body, headers = {}, cookies = {} } = options

  const request = new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })

  // Mock cookies
  Object.defineProperty(request, 'cookies', {
    value: {
      get: vi.fn((name: string) => {
        const cookie = cookies[name]
        return cookie ? { value: cookie } : undefined
      }),
      set: vi.fn(),
      delete: vi.fn(),
    },
    writable: true,
    configurable: true,
  })

  return request
}

/**
 * Test helper to mock admin authentication
 */
export function mockAdminAuth() {
  mockAuth.mockResolvedValue({
    user: {
      id: 'admin-1',
      email: 'admin@test.com',
      isAdmin: true,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
  } satisfies Session)
}

/**
 * Test helper to mock regular user authentication
 */
export function mockUserAuth() {
  mockAuth.mockResolvedValue({
    user: {
      id: 'user-1',
      email: 'user@test.com',
      isAdmin: false,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
  } satisfies Session)
}

/**
 * Test helper to mock no authentication
 */
export function mockNoAuth() {
  mockAuth.mockResolvedValue(null)
}

/**
 * Test helper to clear all auth mocks
 */
export function clearAuthMocks() {
  mockAuth.mockClear()
}

/**
 * Test helper to create rate limit test scenarios
 */
export function createRateLimitTest(
  handler: (request: NextRequest) => Promise<NextResponse>,
  requestCount: number,
  expectedStatus: number
) {
  return async () => {
    const requests = Array.from({ length: requestCount }, (_, i) =>
      createMockRequest('http://localhost/api/test', {
        headers: {
          'X-Forwarded-For': `192.168.1.${i + 1}`,
          'User-Agent': `TestAgent-${i + 1}`,
        },
      })
    )

    const responses = await Promise.all(requests.map((req) => handler(req)))

    const lastResponse = responses[responses.length - 1]
    expect(lastResponse.status).toBe(expectedStatus)

    if (expectedStatus === 429) {
      const data = await lastResponse.json()
      expect(data.error).toBe('Too many requests')
      expect(data.retryAfter).toBeDefined()
      expect(data.limit).toBeDefined()
    }
  }
}

/**
 * Test helper to test admin protection
 */
export async function testAdminProtection(
  handler: (request: NextRequest) => Promise<NextResponse>,
  request: NextRequest,
  expectedStatus: number = 401
) {
  mockNoAuth()

  const response = await handler(request)
  expect(response.status).toBe(expectedStatus)

  if (expectedStatus === 401) {
    const data = await response.json()
    expect(data.error).toBe('Unauthorized - Admin access required')
  }
}

/**
 * Test helper to test user protection
 */
export async function testUserProtection(
  handler: (request: NextRequest) => Promise<NextResponse>,
  request: NextRequest,
  expectedStatus: number = 401
) {
  mockNoAuth()

  const response = await handler(request)
  expect(response.status).toBe(expectedStatus)

  if (expectedStatus === 401) {
    const data = await response.json()
    expect(data.error).toBe('Unauthorized - Authentication required')
  }
}

/**
 * Test helper to test rate limiting
 */
export async function testRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  requestCount: number,
  limit: number,
  expectedStatus: number = 429
) {
  const requests = Array.from({ length: requestCount }, (_, i) =>
    createMockRequest('http://localhost/api/test', {
      headers: {
        'X-Forwarded-For': `192.168.1.${(i % 10) + 1}`, // Vary IPs slightly
        'User-Agent': `TestAgent-${i + 1}`,
      },
    })
  )

  const responses = await Promise.all(requests.map((req) => handler(req)))

  const lastResponse = responses[responses.length - 1]
  expect(lastResponse.status).toBe(expectedStatus)

  if (expectedStatus === 429) {
    const data = await lastResponse.json()
    expect(data.error).toBe('Too many requests')
    expect(data.limit).toBe(limit)
  }
}
