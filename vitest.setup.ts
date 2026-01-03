import '@testing-library/jest-dom'
import { server } from './src/__mocks__/server'
import { vi } from 'vitest'

// Configure React Testing Library
import { configure } from '@testing-library/react'

configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000,
})

// Mock IntersectionObserver for components that use it
class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  constructor(
    _callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit
  ) {}
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

// Mock ResizeObserver for components that use it (e.g., PhotoSlideshow badge positioning)
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  constructor(_callback: ResizeObserverCallback) {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver)

// Mock scrollIntoView (not implemented in jsdom)
// Runs in beforeAll since Element isn't available at module load time
beforeAll(() => {
  if (typeof Element !== 'undefined') {
    Element.prototype.scrollIntoView = vi.fn()
  }
})

// Mock Next.js modules using importOriginal
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()

  const NextRequest = class NextRequest {
    constructor(
      public url: string,
      public init?: RequestInit
    ) {}
    async json() {
      return {}
    }
    get headers() {
      return new Headers()
    }
    get method() {
      return this.init?.method || 'GET'
    }
  }

  const NextResponse = {
    json: (data: unknown, init?: ResponseInit) => {
      const response = {
        json: () => Promise.resolve(data),
        status: init?.status || 200,
        headers: new Headers(init?.headers),
        ...init,
      }
      return response
    },
  }

  return {
    ...actual,
    NextRequest,
    NextResponse,
  }
})

// Mock next-auth to prevent module resolution issues
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({
    handlers: {},
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}))

// Mock nav-data which uses unstable_cache that doesn't work in test environment
vi.mock('@/lib/nav-data', () => ({
  getNavEvents: vi.fn().mockResolvedValue({ upcoming: [], past: [] }),
}))

// Mock next/navigation for components that use useRouter, usePathname, etc.
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
}))

// Establish API mocking before all tests
beforeAll(() => server.listen())

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests
afterEach(() => server.resetHandlers())

// Clean up after the tests are finished
afterAll(() => server.close())
