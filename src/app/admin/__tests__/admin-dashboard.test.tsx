import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { server } from '@/__mocks__/server'
import { http, HttpResponse } from 'msw'
import AdminDashboard from '../admin-dashboard'

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) {
    return <a href={href}>{children}</a>
  },
}))

// Use MSW for fetch mocking

const mockSession = {
  user: {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@example.com',
    isAdmin: true,
  },
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // MSW will handle the fetch mocking
  })

  it('renders dashboard with quick action cards', async () => {
    render(<AdminDashboard session={mockSession} />)

    // Check quick action cards are rendered
    expect(screen.getByText('Videos')).toBeInTheDocument()
    expect(screen.getByText('Social')).toBeInTheDocument()
    expect(screen.getByText('Photos')).toBeInTheDocument()
    expect(screen.getByText('Companies')).toBeInTheDocument()
    expect(screen.getByText('Photographers')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    render(<AdminDashboard session={mockSession} />)
    expect(screen.getByText('Loading events...')).toBeInTheDocument()
  })

  it('renders events list when data is loaded', async () => {
    render(<AdminDashboard session={mockSession} />)

    await waitFor(() => {
      expect(screen.getByText('Test Event 1')).toBeInTheDocument()
      expect(screen.getByText('Test Event 2')).toBeInTheDocument()
    })
  })

  it('displays event details correctly', async () => {
    render(<AdminDashboard session={mockSession} />)

    const expectedDate = new Date('2024-12-25T18:30:00Z').toLocaleDateString(
      'en-AU',
      {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }
    )

    await waitFor(() => {
      // Check first event details
      expect(screen.getByText('Test Event 1')).toBeInTheDocument()
      expect(screen.getByText('Test Venue 1')).toBeInTheDocument()
      expect(screen.getByText(expectedDate)).toBeInTheDocument()
    })
  })

  it('shows correct status badges for different event statuses', async () => {
    render(<AdminDashboard session={mockSession} />)

    await waitFor(
      () => {
        // Check that status dropdowns are rendered with correct values
        const statusSelects = screen.getAllByRole('combobox')
        expect(statusSelects).toHaveLength(3)

        // Check first event (voting)
        const votingSelect = statusSelects[0]
        expect(votingSelect).toHaveValue('voting')
        expect(votingSelect).toHaveClass('text-success')

        // Check second event (upcoming)
        const upcomingSelect = statusSelects[1]
        expect(upcomingSelect).toHaveValue('upcoming')
        expect(upcomingSelect).toHaveClass('text-blue-400')

        // Check third event (finalized)
        const finalizedSelect = statusSelects[2]
        expect(finalizedSelect).toHaveValue('finalized')
        expect(finalizedSelect).toHaveClass('text-text-muted')
      },
      { timeout: 10000 }
    )
  })

  it('renders Manage Event button for each event', async () => {
    render(<AdminDashboard session={mockSession} />)

    await waitFor(
      () => {
        const manageButtons = screen.getAllByRole('link', {
          name: 'Manage',
        })
        expect(manageButtons).toHaveLength(3)
      },
      { timeout: 10000 }
    )
  })

  it('links Manage Event button to correct event admin page', async () => {
    render(<AdminDashboard session={mockSession} />)

    await waitFor(() => {
      const manageButtons = screen.getAllByRole('link', {
        name: 'Manage',
      })

      // Check that each button links to the correct event admin page
      expect(manageButtons[0]).toHaveAttribute('href', '/admin/events/event-1')
      expect(manageButtons[1]).toHaveAttribute('href', '/admin/events/event-2')
    })
  })

  it('shows no events message when no events are returned', async () => {
    server.use(
      http.get('/api/events', () => {
        return HttpResponse.json([])
      })
    )

    render(<AdminDashboard session={mockSession} />)

    await waitFor(() => {
      expect(screen.getByText('No events found')).toBeInTheDocument()
    })
  })

  it('handles fetch error gracefully', async () => {
    // Mock console.error to suppress output and verify it's called
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    server.use(
      http.get('/api/events', () => {
        return HttpResponse.error()
      })
    )

    render(<AdminDashboard session={mockSession} />)

    await waitFor(() => {
      expect(screen.getByText('No events found')).toBeInTheDocument()
    })

    // Verify console.error was called with the expected error
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error fetching events:',
      expect.any(Error)
    )

    consoleSpy.mockRestore()
  })

  it('handles fetch response error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    server.use(
      http.get('/api/events', () => {
        return HttpResponse.json({ error: 'Server error' }, { status: 500 })
      })
    )

    render(<AdminDashboard session={mockSession} />)

    await waitFor(() => {
      expect(screen.getByText('No events found')).toBeInTheDocument()
    })

    // Assert that console.error was called with the expected error
    expect(consoleSpy).toHaveBeenCalledWith('Error fetching events:', 500, {
      error: 'Server error',
    })

    consoleSpy.mockRestore()
  })

  it('links to correct quick action pages', () => {
    render(<AdminDashboard session={mockSession} />)

    // Check quick action links
    expect(screen.getByRole('link', { name: /Videos/i })).toHaveAttribute(
      'href',
      '/admin/videos'
    )
    expect(screen.getByRole('link', { name: /Social/i })).toHaveAttribute(
      'href',
      '/admin/social'
    )
    expect(screen.getByRole('link', { name: /Photos/i })).toHaveAttribute(
      'href',
      '/admin/photos'
    )
    expect(screen.getByRole('link', { name: /Companies/i })).toHaveAttribute(
      'href',
      '/admin/companies'
    )
    expect(
      screen.getByRole('link', { name: /Photographers/i })
    ).toHaveAttribute('href', '/admin/photographers')
  })
})
