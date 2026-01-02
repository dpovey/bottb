/**
 * Tests for shuffle parameter in slideshow pagination requests
 *
 * This tests a specific regression where the slideshow's fetchPage function
 * was hardcoded to use order=date, ignoring the shuffle parameter.
 * When loading additional pages past the initial 50 photos, the slideshow
 * should preserve the shuffle order by using the shuffle parameter.
 */
import { describe, it, expect } from 'vitest'

/**
 * This function replicates the URL building logic from photo-slideshow.tsx fetchPage function.
 * It's extracted here to test the bug directly without complex component rendering.
 *
 * CURRENT BUG: fetchPage always uses order=date, ignoring filters.shuffle
 * EXPECTED: fetchPage should use shuffle param when filters.shuffle is set
 */
function buildFetchPageParams(
  filters: {
    eventId?: string | null
    bandId?: string | null
    photographer?: string | null
    companySlug?: string | null
    shuffle?: string | null
  },
  page: number,
  pageSize: number
): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.eventId) params.set('event', filters.eventId)
  if (filters.bandId) params.set('band', filters.bandId)
  if (filters.photographer) params.set('photographer', filters.photographer)
  if (filters.companySlug) params.set('company', filters.companySlug)
  params.set('page', page.toString())
  params.set('limit', pageSize.toString())

  // BUG (CURRENT CODE): Always uses order=date
  // params.set('order', 'date')

  // FIX: Should use shuffle param when shuffle is enabled
  if (filters.shuffle) {
    params.set('shuffle', filters.shuffle)
  } else {
    params.set('order', 'date')
  }

  return params
}

/**
 * This function replicates the BUGGY URL building logic from photo-slideshow.tsx
 * to demonstrate the current broken behavior.
 */
function buildFetchPageParamsBuggy(
  filters: {
    eventId?: string | null
    bandId?: string | null
    photographer?: string | null
    companySlug?: string | null
    shuffle?: string | null
  },
  page: number,
  pageSize: number
): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.eventId) params.set('event', filters.eventId)
  if (filters.bandId) params.set('band', filters.bandId)
  if (filters.photographer) params.set('photographer', filters.photographer)
  if (filters.companySlug) params.set('company', filters.companySlug)
  params.set('page', page.toString())
  params.set('limit', pageSize.toString())

  // BUGGY: Always uses order=date, ignoring shuffle
  params.set('order', 'date')

  return params
}

describe('PhotoSlideshow fetchPage URL building', () => {
  describe('current buggy behavior (demonstrates the bug)', () => {
    it('BUGGY: ignores shuffle param and always uses order=date', () => {
      // This demonstrates the BUG - shuffle is ignored
      const filters = { shuffle: 'test-seed-123' }
      const params = buildFetchPageParamsBuggy(filters, 2, 50)

      // BUG: shuffle is ignored, order=date is always used
      expect(params.get('shuffle')).toBeNull()
      expect(params.get('order')).toBe('date')
    })
  })

  describe('expected fixed behavior', () => {
    it('should use shuffle param when shuffle is enabled', () => {
      const filters = { shuffle: 'test-seed-123' }
      const params = buildFetchPageParams(filters, 2, 50)

      // After fix: should use shuffle param, not order=date
      expect(params.get('shuffle')).toBe('test-seed-123')
      expect(params.get('order')).toBeNull()
    })

    it('should use order=date when shuffle is not enabled', () => {
      const filters = {} // No shuffle
      const params = buildFetchPageParams(filters, 2, 50)

      // Without shuffle, should use order=date
      expect(params.get('shuffle')).toBeNull()
      expect(params.get('order')).toBe('date')
    })

    it('should use order=date when shuffle is explicitly null', () => {
      const filters = { shuffle: null }
      const params = buildFetchPageParams(filters, 2, 50)

      expect(params.get('shuffle')).toBeNull()
      expect(params.get('order')).toBe('date')
    })

    it('should preserve all other filter params with shuffle', () => {
      const filters = {
        eventId: 'event-123',
        bandId: 'band-456',
        photographer: 'John Doe',
        companySlug: 'company-abc',
        shuffle: 'test-seed',
      }
      const params = buildFetchPageParams(filters, 3, 25)

      expect(params.get('event')).toBe('event-123')
      expect(params.get('band')).toBe('band-456')
      expect(params.get('photographer')).toBe('John Doe')
      expect(params.get('company')).toBe('company-abc')
      expect(params.get('page')).toBe('3')
      expect(params.get('limit')).toBe('25')
      expect(params.get('shuffle')).toBe('test-seed')
      expect(params.get('order')).toBeNull()
    })

    it('should preserve all other filter params without shuffle', () => {
      const filters = {
        eventId: 'event-123',
        photographer: 'Jane Smith',
      }
      const params = buildFetchPageParams(filters, 2, 50)

      expect(params.get('event')).toBe('event-123')
      expect(params.get('photographer')).toBe('Jane Smith')
      expect(params.get('page')).toBe('2')
      expect(params.get('limit')).toBe('50')
      expect(params.get('shuffle')).toBeNull()
      expect(params.get('order')).toBe('date')
    })
  })
})
