import { render, screen, waitFor } from '@testing-library/react'
import { vi, beforeAll, beforeEach, describe, it, expect } from 'vitest'
import { useSearchParams, useRouter } from 'next/navigation'
import { PhotosContent } from '../photos-content'

// Mock next-auth/react
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock IntersectionObserver
beforeAll(() => {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
})

// Mock window.history for URL updates
beforeAll(() => {
  Object.defineProperty(window, 'history', {
    value: {
      replaceState: vi.fn(),
      pushState: vi.fn(),
    },
    writable: true,
  })
})

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
  })),
}))

// Mock the API responses
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock the database functions
vi.mock('@/lib/db', () => ({
  getPhotos: vi.fn(),
  getPhotoCount: vi.fn(),
  getDistinctPhotographers: vi.fn(),
  getDistinctCompanies: vi.fn(),
  getAvailablePhotoFilters: vi.fn(),
  PHOTO_LABELS: {
    BAND_HERO: 'band_hero',
    EVENT_HERO: 'event_hero',
    GLOBAL_HERO: 'global_hero',
  },
}))

// Mock photo data for slideshow tests (keeping for potential future tests)
const _mockPhotos = [
  {
    id: 'photo-1',
    blob_url: 'https://example.com/photo1.jpg',
    blob_pathname: 'photos/photo-1/large.webp',
    original_filename: 'photo1.jpg',
    thumbnail_url: 'https://example.com/thumb1.jpg',
    original_blob_url: 'https://example.com/original1.jpg',
    event_id: 'event-1',
    band_id: 'band-1',
    event_name: 'Test Event',
    band_name: 'Test Band',
    photographer: 'Test Photographer',
    labels: [],
    hero_focal_point: { x: 0.5, y: 0.5 },
    event_date: '2024-01-01',
    company_slug: 'test-co',
    company_name: 'Test Company',
    company_icon_url: null,
    is_hero_for_band: false,
    is_hero_for_event: false,
    is_global_hero: false,
    created_at: '2024-01-01T00:00:00Z',
    thumbnail_2x_url: null,
    thumbnail_3x_url: null,
    large_4k_url: null,
  },
  {
    id: 'photo-2',
    blob_url: 'https://example.com/photo2.jpg',
    blob_pathname: 'photos/photo-2/large.webp',
    original_filename: 'photo2.jpg',
    thumbnail_url: 'https://example.com/thumb2.jpg',
    original_blob_url: 'https://example.com/original2.jpg',
    event_id: 'event-1',
    band_id: 'band-2',
    event_name: 'Test Event',
    band_name: 'Another Band',
    photographer: 'Test Photographer',
    labels: [],
    hero_focal_point: { x: 0.5, y: 0.5 },
    event_date: '2024-01-01',
    company_slug: 'test-co',
    company_name: 'Test Company',
    company_icon_url: null,
    is_hero_for_band: false,
    is_hero_for_event: false,
    is_global_hero: false,
    created_at: '2024-01-01T00:00:00Z',
    thumbnail_2x_url: null,
    thumbnail_3x_url: null,
    large_4k_url: null,
  },
]

describe('PhotosContent - Navigation to Slideshow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  it('should render gallery without slideshow modal', async () => {
    const mockPush = vi.fn()
    ;(useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
    })
    ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue({
      get: vi.fn(() => null),
    })

    // Mock API to return photos
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        photos: [
          {
            id: 'photo-1',
            blob_url: 'https://example.com/photo1.jpg',
            thumbnail_url: 'https://example.com/thumb1.jpg',
            event_id: 'event-1',
            band_id: 'band-1',
            event_name: 'Test Event',
            band_name: 'Test Band',
            photographer: 'Test Photographer',
            labels: [],
            company_slug: null,
            company_name: null,
          },
        ],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        photographers: ['Test Photographer'],
        companies: [],
        availableFilters: {
          companies: [],
          events: [],
          photographers: [],
          hasPhotosWithoutCompany: false,
        },
      }),
    })

    render(
      <PhotosContent
        initialEventId={null}
        initialPhotographer={null}
        initialCompanySlug={null}
        initialPhotoId={null}
      />
    )

    // Wait for the gallery title to render
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Photo Gallery/i })
      ).toBeInTheDocument()
    })

    // Gallery should render without a slideshow modal (slideshow is now a separate route)
    expect(
      screen.queryByRole('button', { name: /close slideshow/i })
    ).not.toBeInTheDocument()
  })
})

// TODO: Add infinite scroll tests - complex to mock IntersectionObserver callbacks properly

describe('PhotosContent - Filter Defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue({
      get: vi.fn(() => null),
    })
    ;(useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
    })
  })

  // TODO: Fix this test - needs proper mock setup for PhotosContent component
  it.skip("should default photographer filter to 'All Photographers' when no URL param is present", async () => {
    // Mock the API responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ events: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          photos: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
          photographers: ['Photographer 1', 'Photographer 2'],
          companies: [],
          availableFilters: {
            companies: [],
            events: [],
            photographers: [
              { name: 'Photographer 1', count: 5 },
              { name: 'Photographer 2', count: 3 },
            ],
            hasPhotosWithoutCompany: false,
          },
        }),
      })

    render(
      <PhotosContent
        initialEventId={null}
        initialPhotographer={null}
        initialCompanySlug={null}
        initialPhotoId={null}
      />
    )

    // Wait for the photographers list to load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/photos')
      )
    })

    // Wait for the photographer filter to render with options
    await waitFor(() => {
      const photographerSelect = screen.getByLabelText(/photographer/i)
      expect(photographerSelect).toBeInTheDocument()
    })

    // Check that "All Photographers" option is present and selected
    const photographerSelect = screen.getByLabelText(
      /photographer/i
    ) as HTMLSelectElement

    // The select should have value="" when selectedPhotographer is null
    expect(photographerSelect.value).toBe('')

    // "All Photographers" option should exist
    const allPhotographersOption = Array.from(photographerSelect.options).find(
      (opt) =>
        opt.value === '' && opt.textContent?.includes('All Photographers')
    )
    expect(allPhotographersOption).toBeTruthy()

    // The selected option should be "All Photographers"
    expect(photographerSelect.selectedOptions[0]?.textContent).toContain(
      'All Photographers'
    )
  })

  // TODO: Fix this test - needs proper mock setup for PhotosContent component
  it.skip("should maintain 'All Photographers' selection when photographers list loads after initial render", async () => {
    let resolvePhotos: (value: unknown) => void
    const photosPromise = new Promise((resolve) => {
      resolvePhotos = resolve
    })

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ events: [] }),
      })
      .mockResolvedValueOnce(photosPromise)

    render(
      <PhotosContent
        initialEventId={null}
        initialPhotographer={null}
        initialCompanySlug={null}
        initialPhotoId={null}
      />
    )

    // Initially, photographers list is empty
    await waitFor(() => {
      const photographerSelect = screen.getByLabelText(/photographer/i)
      expect(photographerSelect).toBeInTheDocument()
    })

    const photographerSelect = screen.getByLabelText(
      /photographer/i
    ) as HTMLSelectElement

    // Initially should have value="" (All Photographers)
    expect(photographerSelect.value).toBe('')

    // Now resolve the photos API call with photographers
    resolvePhotos!({
      photos: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      photographers: ['Photographer 1', 'Photographer 2'],
      companies: [],
      availableFilters: {
        companies: [],
        events: [],
        photographers: [
          { name: 'Photographer 1', count: 5 },
          { name: 'Photographer 2', count: 3 },
        ],
        hasPhotosWithoutCompany: false,
      },
    })

    // Wait for the photographers to load
    await waitFor(() => {
      const options = Array.from(photographerSelect.options)
      expect(options.length).toBeGreaterThan(1) // Should have "All Photographers" + actual photographers
    })

    // After photographers load, should still have "All Photographers" selected
    expect(photographerSelect.value).toBe('')
    expect(photographerSelect.selectedOptions[0]?.textContent).toContain(
      'All Photographers'
    )
  })
})
