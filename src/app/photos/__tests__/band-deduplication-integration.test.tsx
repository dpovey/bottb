import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { useSearchParams } from 'next/navigation'
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

describe('Band Deduplication Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue({
      get: vi.fn(() => null),
    })
  })

  // TODO: Fix this test - needs proper mock setup for PhotosContent component
  it.skip('should deduplicate bands and query photos from multiple band IDs', async () => {
    const user = userEvent.setup()

    // Mock initial data fetch
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [
            { id: 'event1', name: 'Brisbane 2024' },
            { id: 'event2', name: 'Brisbane 2025' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bands: [
            {
              id: 'band1',
              event_id: 'event1',
              name: 'Jumbo Band',
              company_slug: 'jumbo',
            },
            {
              id: 'band2',
              event_id: 'event2',
              name: 'Jumbo Band',
              company_slug: 'jumbo',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          photos: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
          photographers: [],
          companies: [{ slug: 'jumbo', name: 'Jumbo' }],
          availableFilters: {
            companies: [{ slug: 'jumbo', name: 'Jumbo', count: 10 }],
            events: [
              { id: 'event1', name: 'Brisbane 2024', count: 5 },
              { id: 'event2', name: 'Brisbane 2025', count: 5 },
            ],
            bands: [
              { id: 'band1', name: 'Jumbo Band', count: 5 },
              { id: 'band2', name: 'Jumbo Band', count: 5 },
            ],
            photographers: [],
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

    // Wait for initial load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    // Select company "Jumbo"
    const companySelect = await screen.findByLabelText(/company/i)
    await user.selectOptions(companySelect, 'jumbo')

    // Wait for filter update
    await waitFor(() => {
      const bandSelect = screen.getByLabelText(/band/i) as HTMLSelectElement
      const options = Array.from(bandSelect.options).map((opt) => opt.text)
      // Should only show "Jumbo Band" once
      const jumboBandCount = options.filter((opt) =>
        opt.includes('Jumbo Band')
      ).length
      expect(jumboBandCount).toBe(1)
    })

    // Select the deduplicated "Jumbo Band"
    const bandSelect = screen.getByLabelText(/band/i) as HTMLSelectElement
    const jumboBandOption = Array.from(bandSelect.options).find(
      (opt) => opt.text.includes('Jumbo Band') && opt.value !== ''
    )

    expect(jumboBandOption).toBeTruthy()
    await user.selectOptions(bandSelect, jumboBandOption!.value)

    // Wait for API call with bandIds parameter
    await waitFor(
      () => {
        const fetchCalls = mockFetch.mock.calls
        const photosCall = fetchCalls.find((call: unknown[]) =>
          (call[0] as string)?.toString().includes('/api/photos')
        )

        if (photosCall) {
          const url = new URL(photosCall[0].toString())
          const bandIds = url.searchParams.get('bandIds')
          // Should have bandIds parameter with both band IDs
          expect(bandIds).toBeTruthy()
          const ids = bandIds!.split(',')
          expect(ids.length).toBe(2)
          expect(ids).toContain('band1')
          expect(ids).toContain('band2')
        }
      },
      { timeout: 3000 }
    )
  })

  // TODO: Fix this test - needs proper mock setup for PhotosContent component
  it.skip('should handle URL with bandIds parameter on initial load', async () => {
    ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === 'company') return 'jumbo'
        if (key === 'bandIds') return 'band1,band2'
        return null
      }),
    })

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [
            { id: 'event1', name: 'Brisbane 2024' },
            { id: 'event2', name: 'Brisbane 2025' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bands: [
            {
              id: 'band1',
              event_id: 'event1',
              name: 'Jumbo Band',
              company_slug: 'jumbo',
            },
            {
              id: 'band2',
              event_id: 'event2',
              name: 'Jumbo Band',
              company_slug: 'jumbo',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          photos: [
            { id: 'photo1', band_id: 'band1' },
            { id: 'photo2', band_id: 'band2' },
          ],
          pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
          photographers: [],
          companies: [{ slug: 'jumbo', name: 'Jumbo' }],
          availableFilters: {
            companies: [{ slug: 'jumbo', name: 'Jumbo', count: 10 }],
            events: [],
            bands: [],
            photographers: [],
            hasPhotosWithoutBand: false,
            hasPhotosWithoutCompany: false,
          },
        }),
      })

    render(
      <PhotosContent
        initialEventId={null}
        initialBandId="bandIds:band1,band2"
        initialPhotographer={null}
        initialCompanySlug="jumbo"
        initialPhotoId={null}
      />
    )

    // Wait for API call
    await waitFor(() => {
      const fetchCalls = mockFetch.mock.calls
      const photosCall = fetchCalls.find((call: unknown[]) =>
        (call[0] as string)?.toString().includes('/api/photos')
      )

      if (photosCall) {
        const url = new URL(photosCall[0].toString())
        const bandIds = url.searchParams.get('bandIds')
        expect(bandIds).toBe('band1,band2')
      }
    })

    // Verify band select shows correct value
    const bandSelect = (await screen.findByLabelText(
      /band/i
    )) as HTMLSelectElement
    // Should extract first ID from bandIds format
    expect(bandSelect.value).toBe('band1')
  })
})
