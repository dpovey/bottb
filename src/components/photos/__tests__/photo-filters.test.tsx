import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PhotoFilters } from '../photo-filters'
import type { Event } from '@/lib/db'

// Mock the UI components
vi.mock('@/components/ui', () => ({
  FilterBar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="filter-bar">{children}</div>
  ),
  FilterSelect: ({
    label,
    value,
    onChange,
    children,
    disabled,
  }: {
    label: string
    value: string
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
    children: React.ReactNode
    disabled?: boolean
  }) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={onChange}
        disabled={disabled}
      >
        {children}
      </select>
    </label>
  ),
  FilterPill: ({
    children,
    onRemove,
  }: {
    children: React.ReactNode
    onRemove: () => void
  }) => (
    <div data-testid="filter-pill">
      {children}
      <button onClick={onRemove}>Remove</button>
    </div>
  ),
  FilterPills: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="filter-pills">{children}</div>
  ),
  FilterClearButton: ({
    onClick,
    disabled,
  }: {
    onClick: () => void
    disabled?: boolean
  }) => (
    <button onClick={onClick} disabled={disabled}>
      Clear All
    </button>
  ),
}))

describe('PhotoFilters', () => {
  const mockEvents: Event[] = [
    {
      id: 'event1',
      name: 'Brisbane 2024',
      date: '2024-01-01',
      location: 'Brisbane',
      timezone: 'Australia/Brisbane',
      is_active: true,
      status: 'finalized',
      created_at: '2024-01-01',
    },
    {
      id: 'event2',
      name: 'Brisbane 2025',
      date: '2025-01-01',
      location: 'Brisbane',
      timezone: 'Australia/Brisbane',
      is_active: true,
      status: 'finalized',
      created_at: '2025-01-01',
    },
  ]

  const mockCompanies = [
    { slug: 'jumbo', name: 'Jumbo' },
    { slug: 'epsilon', name: 'Epsilon' },
  ]

  const mockAvailableFilters = {
    companies: mockCompanies.map((c) => ({ ...c, count: 10 })),
    events: mockEvents.map((e) => ({ id: e.id, name: e.name, count: 10 })),
    photographers: [{ name: 'Photographer 1', count: 5 }],
    hasPhotosWithoutCompany: false,
  }

  const defaultProps = {
    events: mockEvents,
    photographers: ['Photographer 1', 'Photographer 2'],
    companies: mockCompanies,
    availableFilters: mockAvailableFilters,
    selectedEventId: null,
    selectedPhotographer: null,
    selectedCompanySlug: null,
    onEventChange: vi.fn(),
    onPhotographerChange: vi.fn(),
    onCompanyChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render all filter dropdowns', () => {
      render(<PhotoFilters {...defaultProps} />)

      expect(screen.getByLabelText(/company/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/event/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/photographer/i)).toBeInTheDocument()
    })

    it('should show companies in the company filter', () => {
      render(<PhotoFilters {...defaultProps} />)

      const companySelect = screen.getByLabelText(
        /company/i
      ) as HTMLSelectElement
      const options = Array.from(companySelect.options).map((opt) => opt.text)

      expect(options).toContain('All Companies')
      expect(options).toContain('Jumbo')
      expect(options).toContain('Epsilon')
    })

    it('should show events in the event filter', () => {
      render(<PhotoFilters {...defaultProps} />)

      const eventSelect = screen.getByLabelText(/event/i) as HTMLSelectElement
      const options = Array.from(eventSelect.options).map((opt) => opt.text)

      expect(options).toContain('All Events')
      expect(options).toContain('Brisbane 2024')
      expect(options).toContain('Brisbane 2025')
    })

    it('should show photographers in the photographer filter', () => {
      // Add Photographer 2 to availableFilters for this test
      const propsWithBothPhotographers = {
        ...defaultProps,
        availableFilters: {
          ...defaultProps.availableFilters,
          photographers: [
            { name: 'Photographer 1', count: 5 },
            { name: 'Photographer 2', count: 3 },
          ],
        },
      }
      render(<PhotoFilters {...propsWithBothPhotographers} />)

      const photographerSelect = screen.getByLabelText(
        /photographer/i
      ) as HTMLSelectElement
      const options = Array.from(photographerSelect.options).map(
        (opt) => opt.text
      )

      expect(options).toContain('All Photographers')
      expect(options).toContain('Photographer 1')
      expect(options).toContain('Photographer 2')
    })
  })

  describe('Filter interactions', () => {
    it('should call onCompanyChange when company is selected', async () => {
      const user = userEvent.setup()
      const onCompanyChange = vi.fn()

      render(
        <PhotoFilters {...defaultProps} onCompanyChange={onCompanyChange} />
      )

      const companySelect = screen.getByLabelText(/company/i)
      await user.selectOptions(companySelect, 'jumbo')

      expect(onCompanyChange).toHaveBeenCalledWith('jumbo')
    })

    it('should call onEventChange when event is selected', async () => {
      const user = userEvent.setup()
      const onEventChange = vi.fn()

      render(<PhotoFilters {...defaultProps} onEventChange={onEventChange} />)

      const eventSelect = screen.getByLabelText(/event/i)
      await user.selectOptions(eventSelect, 'event1')

      expect(onEventChange).toHaveBeenCalledWith('event1')
    })

    it('should call onPhotographerChange when photographer is selected', async () => {
      const user = userEvent.setup()
      const onPhotographerChange = vi.fn()

      render(
        <PhotoFilters
          {...defaultProps}
          onPhotographerChange={onPhotographerChange}
        />
      )

      const photographerSelect = screen.getByLabelText(/photographer/i)
      await user.selectOptions(photographerSelect, 'Photographer 1')

      expect(onPhotographerChange).toHaveBeenCalledWith('Photographer 1')
    })

    it('should clear company filter when "All Companies" is selected', async () => {
      const user = userEvent.setup()
      const onCompanyChange = vi.fn()

      render(
        <PhotoFilters
          {...defaultProps}
          selectedCompanySlug="jumbo"
          onCompanyChange={onCompanyChange}
        />
      )

      const companySelect = screen.getByLabelText(/company/i)
      await user.selectOptions(companySelect, '')

      expect(onCompanyChange).toHaveBeenCalledWith(null)
    })
  })

  describe('Faceted filtering (show only valid options)', () => {
    it('should only show companies that have photos with current filters', () => {
      const availableFilters = {
        companies: [{ slug: 'jumbo', name: 'Jumbo', count: 10 }], // Only Jumbo has photos
        events: mockEvents.map((e) => ({ id: e.id, name: e.name, count: 10 })),
        photographers: [{ name: 'Photographer 1', count: 5 }],
        hasPhotosWithoutCompany: false,
      }

      render(
        <PhotoFilters {...defaultProps} availableFilters={availableFilters} />
      )

      const companySelect = screen.getByLabelText(
        /company/i
      ) as HTMLSelectElement
      const options = Array.from(companySelect.options).map((opt) => opt.value)

      // Should show All Companies + Jumbo only (not Epsilon)
      expect(options).toContain('')
      expect(options).toContain('jumbo')
      expect(options).not.toContain('epsilon')
    })

    it('should only show events that have photos with current filters', () => {
      const availableFilters = {
        companies: mockCompanies.map((c) => ({ ...c, count: 10 })),
        events: [{ id: 'event1', name: 'Brisbane 2024', count: 10 }], // Only event1 has photos
        photographers: [{ name: 'Photographer 1', count: 5 }],
        hasPhotosWithoutCompany: false,
      }

      render(
        <PhotoFilters {...defaultProps} availableFilters={availableFilters} />
      )

      const eventSelect = screen.getByLabelText(/event/i) as HTMLSelectElement
      const options = Array.from(eventSelect.options).map((opt) => opt.value)

      // Should show All Events + event1 only
      expect(options).toContain('')
      expect(options).toContain('event1')
      expect(options).not.toContain('event2')
    })

    it('should only show photographers that have photos with current filters', () => {
      const availableFilters = {
        companies: mockCompanies.map((c) => ({ ...c, count: 10 })),
        events: mockEvents.map((e) => ({ id: e.id, name: e.name, count: 10 })),
        photographers: [{ name: 'Photographer 1', count: 5 }], // Only Photographer 1 has photos
        hasPhotosWithoutCompany: false,
      }

      render(
        <PhotoFilters {...defaultProps} availableFilters={availableFilters} />
      )

      const photographerSelect = screen.getByLabelText(
        /photographer/i
      ) as HTMLSelectElement
      const options = Array.from(photographerSelect.options).map(
        (opt) => opt.text
      )

      // Should show All Photographers + Photographer 1 only
      expect(options).toContain('All Photographers')
      expect(options).toContain('Photographer 1')
      expect(options).not.toContain('Photographer 2')
    })

    it('should always show currently selected filter even if not in availableFilters', () => {
      const availableFilters = {
        companies: [], // No companies have photos (maybe filtered out by other criteria)
        events: [],
        photographers: [],
        hasPhotosWithoutCompany: false,
      }

      render(
        <PhotoFilters
          {...defaultProps}
          selectedCompanySlug="jumbo"
          availableFilters={availableFilters}
        />
      )

      const companySelect = screen.getByLabelText(
        /company/i
      ) as HTMLSelectElement
      const options = Array.from(companySelect.options).map((opt) => opt.value)

      // Should still show the currently selected company
      expect(options).toContain('jumbo')
    })
  })

  describe('Filter pills', () => {
    it('should show filter pills when filters are active', () => {
      render(
        <PhotoFilters
          {...defaultProps}
          selectedCompanySlug="jumbo"
          selectedEventId="event1"
        />
      )

      const pills = screen.getAllByTestId('filter-pill')
      expect(pills.length).toBe(2)
    })

    it('should call onCompanyChange(null) when company pill is removed', async () => {
      const user = userEvent.setup()
      const onCompanyChange = vi.fn()

      render(
        <PhotoFilters
          {...defaultProps}
          selectedCompanySlug="jumbo"
          onCompanyChange={onCompanyChange}
        />
      )

      const pills = screen.getAllByTestId('filter-pill')
      const removeButton = pills[0].querySelector('button')
      await user.click(removeButton!)

      expect(onCompanyChange).toHaveBeenCalledWith(null)
    })
  })

  describe('Clear all button', () => {
    it('should be disabled when no filters are active', () => {
      render(<PhotoFilters {...defaultProps} />)

      const clearButton = screen.getByRole('button', { name: /clear all/i })
      expect(clearButton).toBeDisabled()
    })

    it('should clear all filters when clicked', async () => {
      const user = userEvent.setup()
      const onEventChange = vi.fn()
      const onPhotographerChange = vi.fn()
      const onCompanyChange = vi.fn()

      render(
        <PhotoFilters
          {...defaultProps}
          selectedCompanySlug="jumbo"
          selectedEventId="event1"
          selectedPhotographer="Photographer 1"
          onEventChange={onEventChange}
          onPhotographerChange={onPhotographerChange}
          onCompanyChange={onCompanyChange}
        />
      )

      const clearButton = screen.getByRole('button', { name: /clear all/i })
      await user.click(clearButton)

      expect(onEventChange).toHaveBeenCalledWith(null)
      expect(onPhotographerChange).toHaveBeenCalledWith(null)
      expect(onCompanyChange).toHaveBeenCalledWith(null)
    })
  })

  describe('Loading state', () => {
    it('should disable filters when loading', () => {
      render(<PhotoFilters {...defaultProps} loading={true} />)

      expect(screen.getByLabelText(/company/i)).toBeDisabled()
      expect(screen.getByLabelText(/event/i)).toBeDisabled()
      expect(screen.getByLabelText(/photographer/i)).toBeDisabled()
    })
  })
})
