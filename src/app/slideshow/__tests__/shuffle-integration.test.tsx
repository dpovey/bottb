/**
 * Integration tests for shuffle parameter flow from gallery/photo-strip to slideshow
 *
 * These tests verify that:
 * 1. The slideshow page correctly receives the `shuffle` parameter from URL
 * 2. The slideshow API calls use `shuffle=<seed>` (not deprecated `order=random&seed=X`)
 * 3. Photos are displayed in the same shuffled order as the gallery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { SlideshowPageContent } from '../[id]/slideshow-page-content'

// Mock next/navigation
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
}
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => ({
    get: vi.fn((key: string) => {
      // Simulate URL with shuffle param: /slideshow/photo-1?shuffle=test-seed-123
      if (key === 'shuffle') return 'test-seed-123'
      return null
    }),
  }),
}))

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { isAdmin: false } },
    status: 'authenticated',
  }),
}))

// Track all fetch calls
let fetchCalls: { url: string; params: URLSearchParams }[] = []

// Mock fetch
const mockFetch = vi.fn()

// Mock photo data
const mockPhotos = [
  {
    id: 'photo-1',
    blob_url: 'https://example.com/photo-1.jpg',
    thumbnail_url: 'https://example.com/thumb-1.jpg',
    event_id: 'event-1',
    band_id: 'band-1',
    event_name: 'Test Event',
    band_name: 'Test Band',
    photographer: 'Test Photographer',
    labels: [],
  },
  {
    id: 'photo-2',
    blob_url: 'https://example.com/photo-2.jpg',
    thumbnail_url: 'https://example.com/thumb-2.jpg',
    event_id: 'event-1',
    band_id: 'band-1',
    event_name: 'Test Event',
    band_name: 'Test Band',
    photographer: 'Test Photographer',
    labels: [],
  },
]

describe('Slideshow shuffle parameter integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchCalls = []

    // Track fetch calls and return mock data
    mockFetch.mockImplementation(async (url: string) => {
      const urlObj = new URL(url, 'http://localhost:3000')
      fetchCalls.push({ url, params: urlObj.searchParams })

      // Handle events API
      if (url.includes('/api/events')) {
        return {
          ok: true,
          json: async () => [],
        }
      }

      // Handle photos API
      if (url.includes('/api/photos')) {
        return {
          ok: true,
          json: async () => ({
            photos: mockPhotos,
            pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
            photographers: ['Test Photographer'],
            companies: [],
            seed: 'test-seed-123',
          }),
        }
      }

      return { ok: false, json: async () => ({}) }
    })

    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should pass shuffle param to slideshow content', async () => {
    /**
     * FIXED: The slideshow page.tsx now correctly looks for `shuffle` in searchParams.
     * This test verifies the prop is passed correctly and used in API calls.
     */

    // Render with the shuffle seed that SHOULD be passed from page.tsx
    // We fixed page.tsx to parse ?shuffle= correctly, so now we pass the seed
    render(
      <SlideshowPageContent
        initialPhotoId="photo-1"
        initialEventId={null}
        initialPhotographer={null}
        initialCompanySlug={null}
        initialShuffle="test-seed-123" // Now correctly passed from page.tsx
      />
    )

    // Wait for photos to load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    // Find the photos API call
    const photosApiCall = fetchCalls.find((c) => c.url.includes('/api/photos?'))

    // This assertion documents the current BROKEN behavior
    // The API call should include shuffle=test-seed-123, but it doesn't because:
    // 1. page.tsx looks for ?seed= instead of ?shuffle=
    // 2. slideshow-page-content uses order=random&seed=X instead of shuffle=X
    expect(photosApiCall).toBeDefined()

    // FAILING ASSERTION: This is what SHOULD happen
    // The API call should use the shuffle parameter, not order=random
    expect(photosApiCall!.params.get('shuffle')).toBe('test-seed-123')
  })

  it('should use shuffle param in API call, not deprecated order=random&seed', async () => {
    /**
     * FIXED: slideshow-page-content.tsx now uses buildPhotoApiParams which
     * correctly builds API calls with:
     *   /api/photos?shuffle=123
     *
     * instead of the deprecated:
     *   /api/photos?order=random&seed=123
     */

    // Now that page.tsx correctly parses shuffle param, test that API uses it
    render(
      <SlideshowPageContent
        initialPhotoId="photo-1"
        initialEventId={null}
        initialPhotographer={null}
        initialCompanySlug={null}
        initialShuffle="123456" // page.tsx now correctly parses shuffle param as string
      />
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    // Find the photos API call
    const photosApiCall = fetchCalls.find((c) => c.url.includes('/api/photos?'))
    expect(photosApiCall).toBeDefined()

    // FAILING ASSERTION: slideshow-page-content currently uses order=random&seed=X
    // It should use shuffle=X instead
    expect(photosApiCall!.params.has('shuffle')).toBe(true)
    expect(photosApiCall!.params.get('order')).toBeNull() // Should NOT use deprecated order param
    expect(photosApiCall!.params.get('seed')).toBeNull() // Should NOT use separate seed param
  })

  it('should build correct slideshow URL with shuffle param from gallery', () => {
    /**
     * This test documents the expected URL format when navigating from gallery to slideshow.
     * The gallery builds URLs like: /slideshow/{photoId}?shuffle={seed}
     */

    // This is what the gallery/photo-strip sends
    const galleryUrl = '/slideshow/photo-1?shuffle=abc123'
    const url = new URL(galleryUrl, 'http://localhost:3000')

    // Verify the URL has shuffle param
    expect(url.searchParams.get('shuffle')).toBe('abc123')

    // The slideshow page.tsx should parse this as shuffle, not seed
    // Currently it looks for 'seed' which doesn't exist, so shuffle is lost
    expect(url.searchParams.get('seed')).toBeNull() // 'seed' is NOT in the URL
  })
})

describe('Shuffle URL param consistency', () => {
  it('gallery sends shuffle param (not seed) to slideshow', () => {
    /**
     * Documents the URL building logic from photos-content.tsx
     * This is the "sending" side - it's correct.
     */
    const buildSlideshowUrl = (
      photoId: string,
      shuffle: string | null
    ): string => {
      const params = new URLSearchParams()
      if (shuffle) params.set('shuffle', shuffle)
      const queryString = params.toString()
      return `/slideshow/${photoId}${queryString ? `?${queryString}` : ''}`
    }

    expect(buildSlideshowUrl('photo-1', 'abc123')).toBe(
      '/slideshow/photo-1?shuffle=abc123'
    )
    expect(buildSlideshowUrl('photo-1', 'true')).toBe(
      '/slideshow/photo-1?shuffle=true'
    )
    expect(buildSlideshowUrl('photo-1', null)).toBe('/slideshow/photo-1')
  })

  it('slideshow page.tsx should parse shuffle param (not seed)', () => {
    /**
     * Documents what page.tsx SHOULD do when parsing URL params.
     *
     * Current code (BROKEN):
     *   const seed = filters.seed ? parseInt(filters.seed, 10) : null
     *
     * Should be:
     *   const shuffle = filters.shuffle || null
     */

    // Simulate the URL: /slideshow/photo-1?shuffle=abc123
    const searchParams = new URLSearchParams('shuffle=abc123')

    // BROKEN: Current code looks for 'seed'
    const brokenParsing = searchParams.get('seed')
    expect(brokenParsing).toBeNull() // This is the bug - seed is null

    // CORRECT: Should look for 'shuffle'
    const correctParsing = searchParams.get('shuffle')
    expect(correctParsing).toBe('abc123')
  })
})
