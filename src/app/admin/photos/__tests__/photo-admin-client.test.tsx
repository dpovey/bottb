import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { server } from '@/__mocks__/server'
import { http, HttpResponse } from 'msw'
import { PhotoAdminClient } from '../photo-admin-client'
import { Photo } from '@/lib/db-types'

const mockPhotos: Photo[] = [
  {
    id: 'photo-1',
    blob_url: 'https://example.com/photo1.webp',
    blob_pathname: 'photos/photo-1.webp',
    thumbnail_url: 'https://example.com/photo1-thumb.webp',
    event_id: 'event-1',
    band_id: 'band-1',
    event_name: 'Test Event',
    band_name: 'Test Band',
    photographer: 'John Doe',
    uploaded_at: '2024-01-01T00:00:00Z',
    original_filename: 'photo1.jpg',
    match_confidence: 'exact',
    labels: [],
    hero_focal_point: { x: 50, y: 50 },
    is_monochrome: false,
    created_at: '2024-01-01T00:00:00Z',
    width: null,
    height: null,
    file_size: null,
    content_type: null,
    xmp_metadata: null,
    matched_event_name: null,
    matched_band_name: null,
    uploaded_by: null,
    captured_at: null,
    original_blob_url: null,
    slug: 'test-band-test-event-1',
    slug_prefix: 'test-band-test-event',
  },
  {
    id: 'photo-2',
    blob_url: 'https://example.com/photo2.webp',
    blob_pathname: 'photos/photo-2.webp',
    thumbnail_url: 'https://example.com/photo2-thumb.webp',
    event_id: null,
    band_id: null,
    event_name: undefined,
    band_name: undefined,
    photographer: null,
    uploaded_at: '2024-01-02T00:00:00Z',
    original_filename: 'photo2.jpg',
    match_confidence: 'unmatched',
    labels: [],
    hero_focal_point: { x: 50, y: 50 },
    is_monochrome: false,
    created_at: '2024-01-02T00:00:00Z',
    width: null,
    height: null,
    file_size: null,
    content_type: null,
    xmp_metadata: null,
    matched_event_name: null,
    matched_band_name: null,
    uploaded_by: null,
    captured_at: null,
    original_blob_url: null,
    slug: 'photo-2',
    slug_prefix: 'photo',
  },
]

const mockEvents = [
  { id: 'event-1', name: 'Test Event' },
  { id: 'event-2', name: 'Another Event' },
]

const mockBandsMap = {
  'event-1': [
    { id: 'band-1', name: 'Test Band' },
    { id: 'band-2', name: 'Second Band' },
  ],
  'event-2': [{ id: 'band-3', name: 'Third Band' }],
}

const mockPhotographers = ['John Doe', 'Jane Smith']

describe('PhotoAdminClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders photos count', () => {
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={2}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      expect(screen.getByText('Photos (2)')).toBeInTheDocument()
    })

    it('renders photo rows', () => {
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={2}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      // Find the table body and check content
      const table = screen.getByRole('table')
      expect(within(table).getAllByText('Test Event')).toHaveLength(1) // Only in row, not dropdown
      expect(within(table).getByText('Test Band')).toBeInTheDocument()
      expect(within(table).getByText('John Doe')).toBeInTheDocument()
    })

    it('renders filter controls', () => {
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={2}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      expect(screen.getByText('All Events')).toBeInTheDocument()
      expect(screen.getByText('All Bands')).toBeInTheDocument()
      expect(screen.getByText('All Photographers')).toBeInTheDocument()
      expect(screen.getByText('Unmatched only')).toBeInTheDocument()
    })

    it('shows empty state when no photos', () => {
      render(
        <PhotoAdminClient
          initialPhotos={[]}
          initialTotal={0}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      expect(
        screen.getByText('No photos found matching your filters')
      ).toBeInTheDocument()
    })

    it('shows warning for unmatched photos', () => {
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={2}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      // The "None" text appears for unmatched event/band
      const noneElements = screen.getAllByText('None')
      expect(noneElements.length).toBeGreaterThanOrEqual(2) // Event + Band missing on photo-2
    })

    it('shows match confidence badges', () => {
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={2}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      expect(screen.getByText('exact')).toBeInTheDocument()
      expect(screen.getByText('unmatched')).toBeInTheDocument()
    })
  })

  describe('selection', () => {
    it('selects photo when checkbox is clicked', async () => {
      const user = userEvent.setup()
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={2}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      // Find the table body checkboxes (skip filter checkboxes and header)
      const table = screen.getByRole('table')
      const checkboxes = within(table).getAllByRole('checkbox')
      // First checkbox is header "select all", others are row checkboxes
      await user.click(checkboxes[1]) // First row checkbox

      // Should show selection bar
      expect(screen.getByText(/1 photo selected/)).toBeInTheDocument()
    })

    it('selects all photos when Select All is clicked', async () => {
      const user = userEvent.setup()
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={2}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      await user.click(screen.getByRole('button', { name: /select all/i }))

      expect(screen.getByText('2 photos selected')).toBeInTheDocument()
    })

    it('clears selection when Clear Selection is clicked', async () => {
      const user = userEvent.setup()
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={2}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      // Select all first
      await user.click(screen.getByRole('button', { name: /select all/i }))
      expect(screen.getByText('2 photos selected')).toBeInTheDocument()

      // Clear selection
      await user.click(screen.getByRole('button', { name: /clear selection/i }))

      // Selection bar should be gone
      expect(screen.queryByText('photos selected')).not.toBeInTheDocument()
    })
  })

  describe('bulk editing', () => {
    it('shows bulk edit controls when photos selected', async () => {
      const user = userEvent.setup()
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={2}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      // Select photos
      await user.click(screen.getByRole('button', { name: /select all/i }))

      // Bulk edit button should appear
      expect(
        screen.getByRole('button', { name: /bulk edit/i })
      ).toBeInTheDocument()
    })

    it('enters bulk edit mode when Bulk Edit is clicked', async () => {
      const user = userEvent.setup()
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={2}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      // Select photos
      await user.click(screen.getByRole('button', { name: /select all/i }))

      // Enter bulk edit mode
      await user.click(screen.getByRole('button', { name: /bulk edit/i }))

      // Should see bulk edit controls
      expect(screen.getByText('Set Event...')).toBeInTheDocument()
      expect(screen.getByText('Set Band...')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Photographer...')).toBeInTheDocument()
    })

    it('performs bulk update', async () => {
      // Mock the PATCH endpoints
      const patchCalls: string[] = []
      server.use(
        http.patch('/api/photos/:photoId', ({ params }) => {
          patchCalls.push(params.photoId as string)
          return HttpResponse.json({
            photo: { id: params.photoId, event_id: 'event-2' },
          })
        }),
        http.get('/api/photos', () => {
          return HttpResponse.json({
            photos: mockPhotos,
            pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
          })
        })
      )

      const user = userEvent.setup()
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={2}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      // Select all photos
      await user.click(screen.getByRole('button', { name: /select all/i }))

      // Enter bulk edit mode
      await user.click(screen.getByRole('button', { name: /bulk edit/i }))

      // Select an event from dropdown
      const eventSelect = screen.getByDisplayValue('Set Event...')
      await user.selectOptions(eventSelect, 'event-2')

      // Click Apply in bulk edit bar (has class bg-success)
      const applyButtons = screen.getAllByRole('button', { name: 'Apply' })
      const bulkApplyButton = applyButtons.find((btn) =>
        btn.classList.contains('bg-success')
      )!
      await user.click(bulkApplyButton)

      // Wait for updates to complete
      await waitFor(() => {
        expect(patchCalls).toContain('photo-1')
        expect(patchCalls).toContain('photo-2')
      })
    })
  })

  describe('inline editing', () => {
    it('enters edit mode when edit button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={2}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      // Find and click edit button on first photo
      const editButtons = screen.getAllByTitle('Edit')
      await user.click(editButtons[0])

      // Should see Save and Cancel buttons in edit mode
      expect(screen.getByTitle('Save')).toBeInTheDocument()
      expect(screen.getByTitle('Cancel')).toBeInTheDocument()
    })

    it('saves edits when save button is clicked', async () => {
      let patchedData: Record<string, unknown> = {}
      server.use(
        http.patch('/api/photos/:photoId', async ({ request }) => {
          patchedData = (await request.json()) as Record<string, unknown>
          return HttpResponse.json({
            photo: { id: 'photo-1', ...patchedData },
          })
        }),
        http.get('/api/photos', () => {
          return HttpResponse.json({
            photos: mockPhotos,
            pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
          })
        })
      )

      const user = userEvent.setup()
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={2}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      // Enter edit mode
      const editButtons = screen.getAllByTitle('Edit')
      await user.click(editButtons[0])

      // Find the select in the edit row (should have event-1 as value)
      const rows = screen.getAllByRole('row')
      const firstDataRow = rows[1]
      const selects = within(firstDataRow).getAllByRole('combobox')
      // First select is event, change it
      await user.selectOptions(selects[0], 'event-2')

      // Save
      await user.click(screen.getByTitle('Save'))

      // Verify PATCH was called with correct data
      await waitFor(() => {
        expect(patchedData.event_id).toBe('event-2')
      })
    })

    it('cancels edits when cancel button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={2}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      // Enter edit mode
      const editButtons = screen.getAllByTitle('Edit')
      await user.click(editButtons[0])

      // Find the select and change it
      const rows = screen.getAllByRole('row')
      const firstDataRow = rows[1]
      const selects = within(firstDataRow).getAllByRole('combobox')
      await user.selectOptions(selects[0], 'event-2')

      // Cancel
      await user.click(screen.getByTitle('Cancel'))

      // Should exit edit mode - Edit button should be visible again
      await waitFor(() => {
        expect(screen.getAllByTitle('Edit').length).toBeGreaterThan(0)
      })
    })
  })

  describe('filters', () => {
    beforeEach(() => {
      server.use(
        http.get('/api/photos', ({ request }) => {
          const url = new URL(request.url)
          const eventId = url.searchParams.get('event')
          const unmatched = url.searchParams.get('unmatched')

          let filteredPhotos = mockPhotos

          if (eventId) {
            filteredPhotos = filteredPhotos.filter(
              (p) => p.event_id === eventId
            )
          }

          if (unmatched === 'true') {
            filteredPhotos = filteredPhotos.filter(
              (p) => !p.event_id || !p.band_id
            )
          }

          return HttpResponse.json({
            photos: filteredPhotos,
            pagination: {
              page: 1,
              limit: 50,
              total: filteredPhotos.length,
              totalPages: 1,
            },
          })
        })
      )
    })

    it('filters by event when Apply is clicked', async () => {
      const user = userEvent.setup()
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={2}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      // Select event filter
      const eventSelect = screen.getByDisplayValue('All Events')
      await user.selectOptions(eventSelect, 'event-1')

      // Apply filter
      await user.click(screen.getByRole('button', { name: 'Apply' }))

      // Should now show only 1 photo
      await waitFor(() => {
        expect(screen.getByText('Photos (1)')).toBeInTheDocument()
      })
    })

    it('filters unmatched photos', async () => {
      const user = userEvent.setup()
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={2}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      // Check unmatched filter
      const unmatchedCheckbox = screen.getByRole('checkbox', {
        name: /unmatched/i,
      })
      await user.click(unmatchedCheckbox)

      // Apply filter
      await user.click(screen.getByRole('button', { name: 'Apply' }))

      // Should show only unmatched photo
      await waitFor(() => {
        expect(screen.getByText('Photos (1)')).toBeInTheDocument()
      })
    })

    it('clears filters when Clear is clicked', async () => {
      const user = userEvent.setup()
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={2}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      // Select an event filter
      const eventSelect = screen.getByDisplayValue('All Events')
      await user.selectOptions(eventSelect, 'event-1')

      // Click Clear (FilterClearButton has text "Clear")
      await user.click(screen.getByRole('button', { name: /^clear$/i }))

      // Should refetch (Clear triggers fetch with cleared filters)
      await waitFor(() => {
        // After clearing, the select should be back to "All Events"
        expect(eventSelect).toHaveValue('')
      })
    })
  })

  describe('pagination', () => {
    it('shows pagination info', () => {
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={100}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      expect(screen.getByText('1/2')).toBeInTheDocument()
    })

    it('disables Prev on first page', () => {
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={2}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled()
    })

    it('enables Next when more pages exist', () => {
      render(
        <PhotoAdminClient
          initialPhotos={mockPhotos}
          initialTotal={100}
          events={mockEvents}
          bandsMap={mockBandsMap}
          photographers={mockPhotographers}
        />
      )

      expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled()
    })
  })
})
