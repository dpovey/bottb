import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { server } from '@/__mocks__/server'
import { http, HttpResponse } from 'msw'
import { CompanyAdminClient } from '../company-admin-client'
import { CompanyWithStats } from '@/lib/db-types'

const mockCompanies: CompanyWithStats[] = [
  {
    slug: 'company-1',
    name: 'Test Company 1',
    website: 'https://company1.com',
    icon_url: 'https://example.com/icon1.png',
    band_count: 5,
    event_count: 3,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    slug: 'company-2',
    name: 'Test Company 2',
    website: undefined,
    icon_url: undefined,
    band_count: 0,
    event_count: 0,
    created_at: '2024-01-02T00:00:00Z',
  },
]

describe('CompanyAdminClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders companies list with count', () => {
      render(<CompanyAdminClient initialCompanies={mockCompanies} />)

      expect(screen.getByText('Companies (2)')).toBeInTheDocument()
    })

    it('renders company names', () => {
      render(<CompanyAdminClient initialCompanies={mockCompanies} />)

      expect(screen.getByText('Test Company 1')).toBeInTheDocument()
      expect(screen.getByText('Test Company 2')).toBeInTheDocument()
    })

    it('renders company stats', () => {
      render(<CompanyAdminClient initialCompanies={mockCompanies} />)

      // First company has 5 bands
      expect(screen.getByText('5')).toBeInTheDocument()
      // First company has 3 events
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('renders Add Company button', () => {
      render(<CompanyAdminClient initialCompanies={mockCompanies} />)

      expect(
        screen.getByRole('button', { name: /add company/i })
      ).toBeInTheDocument()
    })

    it('shows empty state when no companies', () => {
      render(<CompanyAdminClient initialCompanies={[]} />)

      expect(screen.getByText('No companies found')).toBeInTheDocument()
      expect(
        screen.getByText('Add your first company to get started')
      ).toBeInTheDocument()
    })

    it('shows website link for companies with websites', () => {
      render(<CompanyAdminClient initialCompanies={mockCompanies} />)

      const websiteLink = screen.getByText('website')
      expect(websiteLink).toHaveAttribute('href', 'https://company1.com')
    })
  })

  describe('adding company', () => {
    it('shows add form when Add Company is clicked', async () => {
      const user = userEvent.setup()
      render(<CompanyAdminClient initialCompanies={mockCompanies} />)

      // Click the Add Company button (in header)
      const addButton = screen.getByRole('button', { name: /add company/i })
      await user.click(addButton)

      // Form should appear
      expect(screen.getByText('Add New Company')).toBeInTheDocument()
      expect(
        screen.getByPlaceholderText('e.g., Dance Corp')
      ).toBeInTheDocument()
    })

    it('creates company on form submit', async () => {
      const user = userEvent.setup()
      render(<CompanyAdminClient initialCompanies={mockCompanies} />)

      // Open form
      await user.click(screen.getByRole('button', { name: /add company/i }))

      // Fill form
      const nameInput = screen.getByPlaceholderText('e.g., Dance Corp')
      await user.type(nameInput, 'New Company')

      // Submit - find the submit button by type="submit" within the form
      const submitButton = nameInput
        .closest('form')!
        .querySelector('button[type="submit"]')!
      await user.click(submitButton)

      // Wait for company to be added
      await waitFor(() => {
        expect(screen.getByText('New Company')).toBeInTheDocument()
      })
    })

    it('shows error when creation fails', async () => {
      server.use(
        http.post('/api/companies', () => {
          return HttpResponse.json(
            { error: 'Company already exists' },
            { status: 409 }
          )
        })
      )

      const user = userEvent.setup()
      render(<CompanyAdminClient initialCompanies={mockCompanies} />)

      // Open form
      await user.click(screen.getByRole('button', { name: /add company/i }))

      // Fill form
      const nameInput = screen.getByPlaceholderText('e.g., Dance Corp')
      await user.type(nameInput, 'Duplicate Company')

      // Submit using form's submit button
      const form = nameInput.closest('form')
      const submitButton = form!.querySelector('button[type="submit"]')!
      await user.click(submitButton)

      // Error should appear
      await waitFor(() => {
        expect(screen.getByText('Company already exists')).toBeInTheDocument()
      })
    })

    it('cancels form when Cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<CompanyAdminClient initialCompanies={mockCompanies} />)

      // Open form
      await user.click(screen.getByRole('button', { name: /add company/i }))
      expect(screen.getByText('Add New Company')).toBeInTheDocument()

      // Cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      // Form should be gone
      expect(screen.queryByText('Add New Company')).not.toBeInTheDocument()
    })
  })

  describe('editing company', () => {
    it('enters edit mode when edit button is clicked', async () => {
      const user = userEvent.setup()
      render(<CompanyAdminClient initialCompanies={mockCompanies} />)

      // Click edit on first company
      const editButtons = screen.getAllByTitle('Edit')
      await user.click(editButtons[0])

      // Should show Save and Cancel buttons
      expect(screen.getByTitle('Save')).toBeInTheDocument()
      expect(screen.getByTitle('Cancel')).toBeInTheDocument()
    })

    it('updates company on save', async () => {
      const user = userEvent.setup()
      render(<CompanyAdminClient initialCompanies={mockCompanies} />)

      // Enter edit mode
      const editButtons = screen.getAllByTitle('Edit')
      await user.click(editButtons[0])

      // Edit name
      const nameInput = screen.getByDisplayValue('Test Company 1')
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Company')

      // Save
      await user.click(screen.getByTitle('Save'))

      // Should update
      await waitFor(() => {
        expect(screen.getByText('Updated Company')).toBeInTheDocument()
      })
    })

    it('cancels edit on cancel', async () => {
      const user = userEvent.setup()
      render(<CompanyAdminClient initialCompanies={mockCompanies} />)

      // Enter edit mode
      const editButtons = screen.getAllByTitle('Edit')
      await user.click(editButtons[0])

      // Cancel
      await user.click(screen.getByTitle('Cancel'))

      // Should exit edit mode (Edit button visible again)
      await waitFor(() => {
        expect(screen.getAllByTitle('Edit')).toHaveLength(2)
      })
    })
  })

  describe('deleting company', () => {
    it('shows confirmation modal when delete is clicked', async () => {
      const user = userEvent.setup()
      render(<CompanyAdminClient initialCompanies={mockCompanies} />)

      // Click delete on second company (no bands)
      const deleteButtons = screen.getAllByTitle('Delete')
      await user.click(deleteButtons[0])

      // Modal should appear
      expect(screen.getByText('Delete Company')).toBeInTheDocument()
      expect(
        screen.getByText(/are you sure you want to delete/i)
      ).toBeInTheDocument()
    })

    it('deletes company when confirmed', async () => {
      const user = userEvent.setup()
      render(<CompanyAdminClient initialCompanies={mockCompanies} />)

      // Click delete on second company (has 0 bands, so delete is enabled)
      const deleteButtons = screen.getAllByTitle('Delete')
      await user.click(deleteButtons[0])

      // Find the modal dialog and confirm button within it
      const modal = screen.getByRole('dialog')
      const confirmButton = modal.querySelector('button.bg-error')!
      await user.click(confirmButton)

      // Company should be removed (we deleted test company 2, the one without bands)
      await waitFor(() => {
        expect(screen.getByText('Companies (1)')).toBeInTheDocument()
      })
    })

    it('closes modal when cancelled', async () => {
      const user = userEvent.setup()
      render(<CompanyAdminClient initialCompanies={mockCompanies} />)

      // Click delete
      const deleteButtons = screen.getAllByTitle('Delete')
      await user.click(deleteButtons[0])

      // Cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText('Delete Company')).not.toBeInTheDocument()
      })
    })

    it('disables delete button for companies with bands', () => {
      render(<CompanyAdminClient initialCompanies={mockCompanies} />)

      // Find delete buttons in rows by their titles
      // First company has 5 bands (should be disabled), second has 0 (should be enabled)
      const disabledDeleteButton = screen.getByTitle(
        'Cannot delete - company has bands'
      )
      const enabledDeleteButton = screen.getByTitle('Delete')

      expect(disabledDeleteButton).toBeDisabled()
      expect(enabledDeleteButton).not.toBeDisabled()
    })
  })
})
