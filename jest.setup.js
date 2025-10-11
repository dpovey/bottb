import '@testing-library/jest-dom'
// import { server } from './src/__mocks__/server'

// Polyfill for Web APIs needed by Next.js API routes
import { TextEncoder, TextDecoder } from 'util'
import { ReadableStream, WritableStream } from 'stream/web'

// Make Web APIs available globally
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
global.ReadableStream = ReadableStream
global.WritableStream = WritableStream

// Polyfill for URL and URLSearchParams
global.URL = class URL {
  constructor(input, base) {
    // Use native URL if available, otherwise create a simple implementation
    if (typeof window !== 'undefined' && window.URL) {
      const url = new window.URL(input, base)
      this.href = url.href
      this.protocol = url.protocol
      this.hostname = url.hostname
      this.port = url.port
      this.pathname = url.pathname
      this.search = url.search
      this.hash = url.hash
    } else {
      // Simple fallback implementation
      this.href = input
      this.protocol = 'http:'
      this.hostname = 'localhost'
      this.port = ''
      this.pathname = input
      this.search = ''
      this.hash = ''
    }
  }
}

global.URLSearchParams = class URLSearchParams {
  constructor(init) {
    this.params = new Map()
    if (init) {
      if (typeof init === 'string') {
        init.split('&').forEach(pair => {
          const [key, value] = pair.split('=')
          if (key) this.params.set(decodeURIComponent(key), decodeURIComponent(value || ''))
        })
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => this.params.set(key, value))
      } else if (init && typeof init === 'object') {
        Object.entries(init).forEach(([key, value]) => this.params.set(key, value))
      }
    }
  }
  
  get(name) {
    return this.params.get(name)
  }
  
  set(name, value) {
    this.params.set(name, value)
  }
  
  has(name) {
    return this.params.has(name)
  }
  
  delete(name) {
    this.params.delete(name)
  }
  
  forEach(callback) {
    this.params.forEach(callback)
  }
  
  toString() {
    return Array.from(this.params.entries())
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&')
  }
}

// Simple polyfill for Request and Response
global.Request = class Request {
  constructor(input, init = {}) {
    const url = typeof input === 'string' ? input : input.url
    Object.defineProperty(this, 'url', {
      value: url,
      writable: false,
      enumerable: true,
      configurable: false
    })
    this.method = init.method || 'GET'
    this.headers = new Headers(init.headers)
    this.body = init.body
  }
  
  async json() {
    return JSON.parse(this.body)
  }
  
  async text() {
    return this.body
  }
}

global.Response = class Response {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status || 200
    this.statusText = init.statusText || 'OK'
    this.headers = new Headers(init.headers)
  }
  
  async json() {
    return JSON.parse(this.body)
  }
  
  async text() {
    return this.body
  }
  
  static json(data, init = {}) {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers
      }
    })
  }
}

global.Headers = class Headers {
  constructor(init = {}) {
    this.map = new Map()
    if (init) {
      if (typeof init === 'object') {
        for (const [key, value] of Object.entries(init)) {
          this.map.set(key.toLowerCase(), value)
        }
      }
    }
  }
  
  get(name) {
    return this.map.get(name.toLowerCase())
  }
  
  set(name, value) {
    this.map.set(name.toLowerCase(), value)
  }
  
  has(name) {
    return this.map.has(name.toLowerCase())
  }
  
  delete(name) {
    this.map.delete(name.toLowerCase())
  }
  
  forEach(callback) {
    this.map.forEach(callback)
  }
  
  entries() {
    return this.map.entries()
  }
  
  keys() {
    return this.map.keys()
  }
  
  values() {
    return this.map.values()
  }
  
  [Symbol.iterator]() {
    return this.map[Symbol.iterator]()
  }
}

// Establish API mocking before all tests
// beforeAll(() => server.listen())

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests
// afterEach(() => server.resetHandlers())

// Clean up after the tests are finished
// afterAll(() => server.close())

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useParams() {
    return {
      eventId: 'test-event-id',
      bandId: 'test-band-id',
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  notFound: jest.fn(),
  redirect: jest.fn(),
}))

// Mock Next.js Link component
jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }) => {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }
  MockLink.displayName = 'MockLink'
  return MockLink
})

// Mock environment variables
process.env.POSTGRES_URL = 'postgres://test:test@localhost:5432/test'

// Suppress expected console errors during tests
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeEach(() => {
  // Suppress console.error for expected test scenarios
  console.error = jest.fn((...args) => {
    const message = args[0]
    
    // Suppress React Testing Library act() warnings (React uses console.error for these)
    if (
      typeof message === 'string' && 
      message.includes('An update to') && 
      message.includes('inside a test was not wrapped in act')
    ) {
      return
    }
    
    // Suppress expected API error logs from tests
    if (
      typeof message === 'string' && (
        message.includes('Error submitting vote:') ||
        message.includes('Error submitting batch votes:') ||
        message.includes('Error fetching bands:') ||
        message.includes('Error fetching event:') ||
        message.includes('Error fetching data:') ||
        message.includes('Error submitting votes:')
      )
    ) {
      // These are expected error logs from API route tests
      return
    }
    
    // Allow other console.error calls to pass through
    originalConsoleError(...args)
  })
  
  // Suppress console.warn for other React warnings
  console.warn = jest.fn((...args) => {
    // Allow other console.warn calls to pass through
    originalConsoleWarn(...args)
  })
})

afterEach(() => {
  // Restore original console methods
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})
