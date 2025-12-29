import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { server } from '@/__mocks__/server'
import { http, HttpResponse } from 'msw'
import { PhotographerAdminClient } from '../photographer-admin-client'
import { PhotographerWithStats } from '@/lib/db-types'

const mockPhotographers: PhotographerWithStats[] = [
  {
    slug: 'john-smith',
    name: 'John Smith',
    bio: 'A professional photographer',
    location: 'Sydney, Australia',
    website: 'https://johnsmith.com',
    instagram: '@johnsmith',
    email: 'john@example.com',
    avatar_url: 'https://example.com/avatar.jpg',
    photo_count: 10,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    slug: 'jane-doe',
    name: 'Jane Doe',
    bio: null,
    location: null,
    website: null,
    instagram: null,
    email: null,
    avatar_url: null,
    photo_count: 0,
    created_at: '2024-01-02T00:00:00Z',
  },
]

describe('PhotographerAdminClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders photographers list with count', () => {
      render(
        <PhotographerAdminClient initialPhotographers={mockPhotographers} />
      )

      expect(screen.getByText('Photographers (2)')).toBeInTheDocument()
    })

    it('renders photographer names', () => {
      render(
        <PhotographerAdminClient initialPhotographers={mockPhotographers} />
      )

      expect(screen.getByText('John Smith')).toBeInTheDocument()
      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    })

    it('renders photographer photo counts', () => {
      render(
        <PhotographerAdminClient initialPhotographers={mockPhotographers} />
      )

      // First photographer has 10 photos
      expect(screen.getByText('10')).toBeInTheDocument()
      // Second photographer has 0 photos
      expect(screen.getAllByText('0')).toHaveLength(1)
    })

    it('renders Add Photographer button', () => {
      render(
        <PhotographerAdminClient initialPhotographers={mockPhotographers} />
      )

      expect(
        screen.getByRole('button', { name: /add photographer/i })
      ).toBeInTheDocument()
    })

    it('shows empty state when no photographers', () => {
      render(<PhotographerAdminClient initialPhotographers={[]} />)

      expect(screen.getByText('No photographers found')).toBeInTheDocument()
      expect(
        screen.getByText('Add your first photographer to get started')
      ).toBeInTheDocument()
    })

    it('shows location for photographers with location', () => {
      render(
        <PhotographerAdminClient initialPhotographers={mockPhotographers} />
      )

      expect(screen.getByText(/Sydney, Australia/)).toBeInTheDocument()
    })

    it('shows website link for photographers with websites', () => {
      render(
        <PhotographerAdminClient initialPhotographers={mockPhotographers} />
      )

      const webLink = screen.getByText('Web')
      expect(webLink).toHaveAttribute('href', 'https://johnsmith.com')
    })

    it('shows Instagram link for photographers with Instagram', () => {
      render(
        <PhotographerAdminClient initialPhotographers={mockPhotographers} />
      )

      const igLink = screen.getByText('IG')
      expect(igLink).toHaveAttribute('href', 'https://instagram.com/johnsmith')
    })
  })

  describe('adding photographer', () => {
    it('shows add form when Add Photographer is clicked', async () => {
      const user = userEvent.setup()
      render(
        <PhotographerAdminClient initialPhotographers={mockPhotographers} />
      )

      await user.click(
        screen.getByRole('button', { name: /add photographer/i })
      )

      expect(screen.getByText('Add New Photographer')).toBeInTheDocument()
      expect(
        screen.getByPlaceholderText('e.g., John Smith')
      ).toBeInTheDocument()
    })

    it('creates photographer on form submit', async () => {
      const user = userEvent.setup()
      render(
        <PhotographerAdminClient initialPhotographers={mockPhotographers} />
      )

      // Open form
      await user.click(
        screen.getByRole('button', { name: /add photographer/i })
      )

      // Fill form
      const nameInput = screen.getByPlaceholderText('e.g., John Smith')
      await user.type(nameInput, 'New Photographer')

      // Submit
      const submitButton = nameInput
        .closest('form')!
        .querySelector('button[type="submit"]')!
      await user.click(submitButton)

      // Wait for photographer to be added
      await waitFor(() => {
        expect(screen.getByText('New Photographer')).toBeInTheDocument()
      })
    })

    it('shows error when creation fails', async () => {
      server.use(
        http.post('/api/photographers', () => {
          return HttpResponse.json(
            { error: 'Photographer already exists' },
            { status: 409 }
          )
        })
      )

      const user = userEvent.setup()
      render(
        <PhotographerAdminClient initialPhotographers={mockPhotographers} />
      )

      // Open form
      await user.click(
        screen.getByRole('button', { name: /add photographer/i })
      )

      // Fill form
      const nameInput = screen.getByPlaceholderText('e.g., John Smith')
      await user.type(nameInput, 'Duplicate')

      // Submit
      const submitButton = nameInput
        .closest('form')!
        .querySelector('button[type="submit"]')!
      await user.click(submitButton)

      // Error should appear
      await waitFor(() => {
        expect(
          screen.getByText('Photographer already exists')
        ).toBeInTheDocument()
      })
    })

    it('cancels form when Cancel is clicked', async () => {
      const user = userEvent.setup()
      render(
        <PhotographerAdminClient initialPhotographers={mockPhotographers} />
      )

      // Open form
      await user.click(
        screen.getByRole('button', { name: /add photographer/i })
      )
      expect(screen.getByText('Add New Photographer')).toBeInTheDocument()

      // Cancel - find the Cancel button that's NOT in the modal footer (form's cancel button)
      const cancelButtons = screen.getAllByRole('button', { name: /cancel/i })
      await user.click(cancelButtons[0])

      // Form should be gone
      expect(screen.queryByText('Add New Photographer')).not.toBeInTheDocument()
    })
  })

  describe('editing photographer', () => {
    it('enters edit mode when edit button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <PhotographerAdminClient initialPhotographers={mockPhotographers} />
      )

      // Click edit on first photographer
      const editButtons = screen.getAllByTitle('Edit')
      await user.click(editButtons[0])

      // Should show Save and Cancel buttons
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    })

    it('updates photographer on save', async () => {
      const user = userEvent.setup()
      render(
        <PhotographerAdminClient initialPhotographers={mockPhotographers} />
      )

      // Enter edit mode
      const editButtons = screen.getAllByTitle('Edit')
      await user.click(editButtons[0])

      // Edit name
      const nameInput = screen.getByDisplayValue('John Smith')
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Name')

      // Save
      await user.click(screen.getByRole('button', { name: /save/i }))

      // Should update
      await waitFor(() => {
        expect(screen.getByText('Updated Name')).toBeInTheDocument()
      })
    })

    it('cancels edit on cancel', async () => {
      const user = userEvent.setup()
      render(
        <PhotographerAdminClient initialPhotographers={mockPhotographers} />
      )

      // Enter edit mode
      const editButtons = screen.getAllByTitle('Edit')
      await user.click(editButtons[0])

      // Edit name
      const nameInput = screen.getByDisplayValue('John Smith')
      await user.clear(nameInput)
      await user.type(nameInput, 'Changed Name')

      // Cancel - find cancel button in edit form (has Cancel text)
      const cancelButtons = screen.getAllByRole('button', { name: /cancel/i })
      await user.click(cancelButtons[0])

      // Should exit edit mode and show original name
      await waitFor(() => {
        expect(screen.getByText('John Smith')).toBeInTheDocument()
      })
    })
  })

  describe('deleting photographer', () => {
    it('shows confirmation modal when delete is clicked', async () => {
      const user = userEvent.setup()
      render(
        <PhotographerAdminClient initialPhotographers={mockPhotographers} />
      )

      // Click delete on second photographer (no photos)
      const deleteButton = screen.getByTitle('Delete')
      await user.click(deleteButton)

      // Modal should appear
      expect(screen.getByText('Delete Photographer')).toBeInTheDocument()
      expect(
        screen.getByText(/are you sure you want to delete/i)
      ).toBeInTheDocument()
    })

    it('deletes photographer when confirmed', async () => {
      const user = userEvent.setup()
      render(
        <PhotographerAdminClient initialPhotographers={mockPhotographers} />
      )

      // Click delete on second photographer (no photos)
      const deleteButton = screen.getByTitle('Delete')
      await user.click(deleteButton)

      // Find the modal and confirm button
      const modal = screen.getByRole('dialog')
      const confirmButton = modal.querySelector('button.bg-error')!
      await user.click(confirmButton)

      // Photographer should be removed
      await waitFor(() => {
        expect(screen.getByText('Photographers (1)')).toBeInTheDocument()
      })
    })

    it('closes modal when cancelled', async () => {
      const user = userEvent.setup()
      render(
        <PhotographerAdminClient initialPhotographers={mockPhotographers} />
      )

      // Click delete
      const deleteButton = screen.getByTitle('Delete')
      await user.click(deleteButton)

      // Cancel (find cancel in the modal)
      const modal = screen.getByRole('dialog')
      const cancelButton = modal.querySelector('button:not(.bg-error)')!
      await user.click(cancelButton)

      // Modal should close
      await waitFor(() => {
        expect(
          screen.queryByText('Delete Photographer')
        ).not.toBeInTheDocument()
      })
    })

    it('disables delete button for photographers with photos', () => {
      render(
        <PhotographerAdminClient initialPhotographers={mockPhotographers} />
      )

      // First photographer has photos (should be disabled)
      const disabledDeleteButton = screen.getByTitle(
        'Cannot delete - photographer has photos'
      )
      // Second photographer has 0 photos (should be enabled)
      const enabledDeleteButton = screen.getByTitle('Delete')

      expect(disabledDeleteButton).toBeDisabled()
      expect(enabledDeleteButton).not.toBeDisabled()
    })
  })
})
