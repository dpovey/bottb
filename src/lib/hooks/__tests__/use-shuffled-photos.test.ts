import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useShuffledPhotos } from '../use-shuffled-photos'
import type { Photo } from '@/lib/db-types'

// Create mock photo data
function createMockPhoto(id: string): Photo {
  return {
    id,
    event_id: 'event-1',
    band_id: 'band-1',
    photographer: 'Test Photographer',
    blob_url: `https://example.com/${id}.jpg`,
    blob_pathname: `photos/${id}.jpg`,
    original_filename: `${id}.jpg`,
    width: 1920,
    height: 1080,
    file_size: 1024000,
    content_type: 'image/jpeg',
    xmp_metadata: null,
    matched_event_name: 'Test Event',
    matched_band_name: 'Test Band',
    match_confidence: 'exact',
    uploaded_by: 'admin',
    uploaded_at: '2024-01-01T00:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
    captured_at: '2024-01-01T00:00:00Z',
    original_blob_url: null,
    labels: [],
    hero_focal_point: { x: 50, y: 50 },
    is_monochrome: null,
    event_name: 'Test Event',
    band_name: 'Test Band',
    thumbnail_url: `https://example.com/${id}-thumb.jpg`,
    slug: `test-band-test-event-${id}`,
    slug_prefix: 'test-band-test-event',
  }
}

const mockPhotos = [
  createMockPhoto('photo-1'),
  createMockPhoto('photo-2'),
  createMockPhoto('photo-3'),
]

// Track fetch calls
let fetchCalls: string[] = []

// Mock fetch
const mockFetch = vi.fn()

describe('useShuffledPhotos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchCalls = []

    // Default mock implementation
    mockFetch.mockImplementation(async (url: string) => {
      fetchCalls.push(url)
      return {
        ok: true,
        json: async () => ({
          photos: mockPhotos,
          pagination: { page: 1, limit: 50, total: 3, totalPages: 1 },
          seed: 'resolved-seed-123',
        }),
      }
    })

    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial state', () => {
    it('starts with shuffle enabled by default', () => {
      const { result } = renderHook(() =>
        useShuffledPhotos({ initialPhotos: mockPhotos, initialTotalCount: 3 })
      )

      expect(result.current.shuffle.enabled).toBe(true)
    })

    it('respects initialShuffle option', () => {
      const { result } = renderHook(() =>
        useShuffledPhotos({
          initialShuffle: null,
          initialPhotos: mockPhotos,
          initialTotalCount: 3,
        })
      )

      expect(result.current.shuffle.enabled).toBe(false)
      expect(result.current.shuffle.seed).toBeNull()
    })

    it('uses specific seed from initialShuffle', () => {
      const { result } = renderHook(() =>
        useShuffledPhotos({
          initialShuffle: 'my-seed-123',
          initialPhotos: mockPhotos,
          initialTotalCount: 3,
        })
      )

      expect(result.current.shuffle.enabled).toBe(true)
      expect(result.current.shuffle.seed).toBe('my-seed-123')
    })

    it('uses initial photos if provided', () => {
      const initialPhotos = [createMockPhoto('initial-1')]

      const { result } = renderHook(() =>
        useShuffledPhotos({
          initialPhotos,
          initialTotalCount: 1,
        })
      )

      expect(result.current.photos).toEqual(initialPhotos)
      expect(result.current.totalCount).toBe(1)
      expect(result.current.loading).toBe(false)
    })
  })

  describe('API calls', () => {
    it('uses shuffle param in API call (not order=random)', async () => {
      renderHook(() => useShuffledPhotos({ initialShuffle: 'test-seed' }))

      // Wait for fetch to be called
      await waitFor(
        () => {
          expect(fetchCalls.length).toBeGreaterThan(0)
        },
        { timeout: 1000 }
      )

      const fetchUrl = fetchCalls[0]
      const params = new URL(fetchUrl, 'http://localhost').searchParams

      // CRITICAL: Must use 'shuffle' param, not 'order' or 'seed'
      expect(params.get('shuffle')).toBe('test-seed')
      expect(params.has('order')).toBe(false)
      expect(params.has('seed')).toBe(false)
    })

    it('includes all filter params', async () => {
      renderHook(() =>
        useShuffledPhotos({
          eventId: 'event-123',
          bandId: 'band-456',
          photographer: 'John Doe',
          companySlug: 'acme',
          initialShuffle: 'seed',
        })
      )

      await waitFor(
        () => {
          expect(fetchCalls.length).toBeGreaterThan(0)
        },
        { timeout: 1000 }
      )

      const fetchUrl = fetchCalls[0]
      const params = new URL(fetchUrl, 'http://localhost').searchParams

      expect(params.get('event')).toBe('event-123')
      expect(params.get('band')).toBe('band-456')
      expect(params.get('photographer')).toBe('John Doe')
      expect(params.get('company')).toBe('acme')
    })

    it('does not include shuffle when disabled, uses order=date instead', async () => {
      renderHook(() => useShuffledPhotos({ initialShuffle: null }))

      await waitFor(
        () => {
          expect(fetchCalls.length).toBeGreaterThan(0)
        },
        { timeout: 1000 }
      )

      const fetchUrl = fetchCalls[0]
      const params = new URL(fetchUrl, 'http://localhost').searchParams

      expect(params.has('shuffle')).toBe(false)
      // When shuffle is disabled, order defaults to 'date' (chronological)
      expect(params.get('order')).toBe('date')
    })

    it('resolves seed from API response when initial is true', async () => {
      const { result } = renderHook(() =>
        useShuffledPhotos({ initialShuffle: 'true' })
      )

      // Wait for fetch and state update
      await waitFor(
        () => {
          expect(result.current.shuffle.seed).toBe('resolved-seed-123')
        },
        { timeout: 1000 }
      )
    })
  })

  describe('toggleShuffle', () => {
    it('turns off shuffle when enabled', () => {
      const { result } = renderHook(() =>
        useShuffledPhotos({
          initialShuffle: 'seed',
          initialPhotos: mockPhotos,
        })
      )

      act(() => {
        result.current.toggleShuffle()
      })

      expect(result.current.shuffle.enabled).toBe(false)
      expect(result.current.shuffle.seed).toBeNull()
    })

    it('turns on shuffle with new seed when disabled', () => {
      const { result } = renderHook(() =>
        useShuffledPhotos({
          initialShuffle: null,
          initialPhotos: mockPhotos,
        })
      )

      act(() => {
        result.current.toggleShuffle()
      })

      expect(result.current.shuffle.enabled).toBe(true)
      expect(result.current.shuffle.seed).toBeTruthy()
      expect(result.current.shuffle.seed).not.toBe('true')
    })

    it('calls onShuffleChange callback', () => {
      const onShuffleChange = vi.fn()
      const { result } = renderHook(() =>
        useShuffledPhotos({
          initialShuffle: 'seed',
          initialPhotos: mockPhotos,
          onShuffleChange,
        })
      )

      act(() => {
        result.current.toggleShuffle()
      })

      expect(onShuffleChange).toHaveBeenCalledWith({
        enabled: false,
        seed: null,
      })
    })
  })

  describe('reshuffle', () => {
    it('generates new seed', () => {
      const { result } = renderHook(() =>
        useShuffledPhotos({
          initialShuffle: 'old-seed',
          initialPhotos: mockPhotos,
        })
      )

      const oldSeed = result.current.shuffle.seed

      act(() => {
        result.current.reshuffle()
      })

      expect(result.current.shuffle.enabled).toBe(true)
      expect(result.current.shuffle.seed).toBeTruthy()
      expect(result.current.shuffle.seed).not.toBe(oldSeed)
    })
  })

  describe('setShuffle', () => {
    it('sets shuffle to specific seed', () => {
      const { result } = renderHook(() =>
        useShuffledPhotos({
          initialShuffle: null,
          initialPhotos: mockPhotos,
        })
      )

      act(() => {
        result.current.setShuffle('new-specific-seed')
      })

      expect(result.current.shuffle.enabled).toBe(true)
      expect(result.current.shuffle.seed).toBe('new-specific-seed')
    })

    it('sets shuffle to null to disable', () => {
      const { result } = renderHook(() =>
        useShuffledPhotos({
          initialShuffle: 'seed',
          initialPhotos: mockPhotos,
        })
      )

      act(() => {
        result.current.setShuffle(null)
      })

      expect(result.current.shuffle.enabled).toBe(false)
      expect(result.current.shuffle.seed).toBeNull()
    })
  })

  describe('buildPhotoUrl', () => {
    it('includes shuffle seed in URL', () => {
      const { result } = renderHook(() =>
        useShuffledPhotos({
          eventId: 'event-1',
          initialShuffle: 'my-seed',
          initialPhotos: mockPhotos,
        })
      )

      const url = result.current.buildPhotoUrl('band-event-123')

      expect(url).toContain('/photos/band-event-123')
      expect(url).toContain('shuffle=my-seed')
      expect(url).toContain('event=event-1')
    })

    it('does not include shuffle when disabled', () => {
      const { result } = renderHook(() =>
        useShuffledPhotos({
          initialShuffle: null,
          initialPhotos: mockPhotos,
        })
      )

      const url = result.current.buildPhotoUrl('band-event-123')

      expect(url).toBe('/photos/band-event-123')
      expect(url).not.toContain('shuffle')
    })

    it('uses resolved seed, not "true"', async () => {
      const { result } = renderHook(() =>
        useShuffledPhotos({ initialShuffle: 'true' })
      )

      // Wait for API to resolve the seed
      await waitFor(
        () => {
          expect(result.current.shuffle.seed).toBe('resolved-seed-123')
        },
        { timeout: 1000 }
      )

      const url = result.current.buildPhotoUrl('band-event-123')

      expect(url).toContain('shuffle=resolved-seed-123')
      expect(url).not.toContain('shuffle=true')
    })
  })

  describe('loadMore', () => {
    it('fetches next page', async () => {
      // Setup initial response with more pages
      mockFetch.mockImplementationOnce(async (url: string) => {
        fetchCalls.push(url)
        return {
          ok: true,
          json: async () => ({
            photos: mockPhotos.slice(0, 2),
            pagination: { page: 1, limit: 2, total: 3, totalPages: 2 },
            seed: 'test-seed',
          }),
        }
      })

      const { result } = renderHook(() =>
        useShuffledPhotos({
          initialShuffle: 'test-seed',
          pageSize: 2,
        })
      )

      // Wait for initial load
      await waitFor(
        () => {
          expect(result.current.photos.length).toBe(2)
        },
        { timeout: 1000 }
      )

      // Setup mock for page 2
      mockFetch.mockImplementationOnce(async (url: string) => {
        fetchCalls.push(url)
        return {
          ok: true,
          json: async () => ({
            photos: [mockPhotos[2]],
            pagination: { page: 2, limit: 2, total: 3, totalPages: 2 },
            seed: 'test-seed',
          }),
        }
      })

      await act(async () => {
        await result.current.loadMore()
      })

      // Check that we now have 3 photos
      expect(result.current.photos.length).toBe(3)

      // Verify page 2 request uses same seed
      const lastFetchUrl = fetchCalls[fetchCalls.length - 1]
      const params = new URL(lastFetchUrl, 'http://localhost').searchParams

      expect(params.get('shuffle')).toBe('test-seed')
      expect(params.get('page')).toBe('2')
    })
  })

  describe('hasMore', () => {
    it('returns true when more photos available', () => {
      // Test with initial data - no fetch needed
      const { result } = renderHook(() =>
        useShuffledPhotos({
          initialPhotos: mockPhotos.slice(0, 2), // 2 photos
          initialTotalCount: 10, // Total of 10
        })
      )

      // 2 photos loaded, 10 total = hasMore should be true
      expect(result.current.hasMore).toBe(true)
    })

    it('returns false when all photos loaded', () => {
      const { result } = renderHook(() =>
        useShuffledPhotos({
          initialPhotos: mockPhotos,
          initialTotalCount: 3,
        })
      )

      expect(result.current.hasMore).toBe(false)
    })
  })

  describe('groupTypes parameter', () => {
    it('defaults to near_duplicate,scene for consistent grouping', async () => {
      renderHook(() =>
        useShuffledPhotos({
          initialShuffle: 'test-seed',
          // No groupTypes option - should use default
        })
      )

      await waitFor(
        () => {
          expect(fetchCalls.length).toBeGreaterThan(0)
        },
        { timeout: 1000 }
      )

      const fetchUrl = fetchCalls[0]
      const params = new URL(fetchUrl, 'http://localhost').searchParams

      // CRITICAL: groupTypes defaults to 'near_duplicate,scene' for consistent photo grouping
      expect(params.get('groupTypes')).toBe('near_duplicate,scene')
    })

    it('allows custom groupTypes to be specified', async () => {
      renderHook(() =>
        useShuffledPhotos({
          initialShuffle: 'test-seed',
          groupTypes: 'near_duplicate', // Only near_duplicate, not scene
        })
      )

      await waitFor(
        () => {
          expect(fetchCalls.length).toBeGreaterThan(0)
        },
        { timeout: 1000 }
      )

      const fetchUrl = fetchCalls[0]
      const params = new URL(fetchUrl, 'http://localhost').searchParams

      expect(params.get('groupTypes')).toBe('near_duplicate')
    })

    it('allows groupTypes to be disabled with false', async () => {
      renderHook(() =>
        useShuffledPhotos({
          initialShuffle: 'test-seed',
          groupTypes: false, // Explicitly disable grouping
        })
      )

      await waitFor(
        () => {
          expect(fetchCalls.length).toBeGreaterThan(0)
        },
        { timeout: 1000 }
      )

      const fetchUrl = fetchCalls[0]
      const params = new URL(fetchUrl, 'http://localhost').searchParams

      expect(params.has('groupTypes')).toBe(false)
    })

    it('includes groupTypes in loadMore API calls', async () => {
      // Setup initial response with more pages
      mockFetch.mockImplementationOnce(async (url: string) => {
        fetchCalls.push(url)
        return {
          ok: true,
          json: async () => ({
            photos: mockPhotos.slice(0, 2),
            pagination: { page: 1, limit: 2, total: 3, totalPages: 2 },
            seed: 'test-seed',
          }),
        }
      })

      const { result } = renderHook(() =>
        useShuffledPhotos({
          initialShuffle: 'test-seed',
          // Uses default groupTypes
          pageSize: 2,
        })
      )

      // Wait for initial load
      await waitFor(
        () => {
          expect(result.current.photos.length).toBe(2)
        },
        { timeout: 1000 }
      )

      // Setup mock for page 2
      mockFetch.mockImplementationOnce(async (url: string) => {
        fetchCalls.push(url)
        return {
          ok: true,
          json: async () => ({
            photos: [mockPhotos[2]],
            pagination: { page: 2, limit: 2, total: 3, totalPages: 2 },
            seed: 'test-seed',
          }),
        }
      })

      await act(async () => {
        await result.current.loadMore()
      })

      // Verify page 2 request includes default groupTypes
      const lastFetchUrl = fetchCalls[fetchCalls.length - 1]
      const params = new URL(lastFetchUrl, 'http://localhost').searchParams

      expect(params.get('groupTypes')).toBe('near_duplicate,scene')
    })
  })
})

describe('Type safety guarantees', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchCalls = []
    mockFetch.mockImplementation(async (url: string) => {
      fetchCalls.push(url)
      return {
        ok: true,
        json: async () => ({
          photos: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        }),
      }
    })
    global.fetch = mockFetch
  })

  it('API calls never use deprecated order=random pattern', async () => {
    renderHook(() => useShuffledPhotos({ initialShuffle: 'any-seed' }))

    await waitFor(
      () => {
        expect(fetchCalls.length).toBeGreaterThan(0)
      },
      { timeout: 1000 }
    )

    // Check all fetch calls
    for (const url of fetchCalls) {
      const params = new URL(url, 'http://localhost').searchParams

      // Must NEVER have order=random or separate seed param
      expect(params.get('order')).toBeNull()
      expect(params.has('seed')).toBe(false)
    }
  })

  it('buildPhotoUrl produces gallery-compatible URLs', () => {
    const { result } = renderHook(() =>
      useShuffledPhotos({
        eventId: 'event-1',
        initialShuffle: 'test-seed',
        initialPhotos: [],
        initialTotalCount: 0,
      })
    )

    const url = result.current.buildPhotoUrl('band-event-123')

    // URL must be compatible with what gallery produces
    expect(url).toMatch(/^\/photos\/band-event-123/)
    expect(url).toContain('shuffle=test-seed')
    expect(url).not.toContain('seed=') // No separate seed param
    expect(url).not.toContain('order=')
  })
})
