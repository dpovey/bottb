import { render, screen, waitFor } from '@testing-library/react'
import { vi, beforeAll } from 'vitest'
import { useSearchParams, useRouter } from 'next/navigation'
import { PhotosContent } from '../photos-content'

// Mock IntersectionObserver
beforeAll(() => {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
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
        json: async () => ({ bands: [] }),
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
            bands: [],
            photographers: [
              { name: 'Photographer 1', count: 5 },
              { name: 'Photographer 2', count: 3 },
            ],
            hasPhotosWithoutBand: false,
            hasPhotosWithoutCompany: false,
          },
        }),
      })

    render(
      <PhotosContent
        initialEventId={null}
        initialBandId={null}
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
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bands: [] }),
      })
      .mockResolvedValueOnce(photosPromise)

    render(
      <PhotosContent
        initialEventId={null}
        initialBandId={null}
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
        bands: [],
        photographers: [
          { name: 'Photographer 1', count: 5 },
          { name: 'Photographer 2', count: 3 },
        ],
        hasPhotosWithoutBand: false,
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
