import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

const mockPush = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// Use MSW for fetch mocking

const events = [
  {
    id: 'event-1',
    name: 'Test Event 1',
    date: '2024-12-25T18:30:00Z',
    location: 'Test Venue 1',
    status: 'voting',
  },
  {
    id: 'event-2',
    name: 'Test Event 2',
    date: '2024-12-26T18:30:00Z',
    location: 'Test Venue 2',
    status: 'upcoming',
  },
  {
    id: 'event-3',
    name: 'Test Event 3',
    date: '2023-12-10T00:00:00Z',
    location: 'Test Venue 3',
    status: 'finalized',
  },
  {
    id: 'event-4',
    name: 'Mid-night Event',
    date: '2026-10-08T08:00:00Z',
    location: 'Factory Theatre',
    status: 'closed',
  },
  {
    id: 'event-5',
    name: 'Announcing Event',
    date: '2026-10-09T08:00:00Z',
    location: 'Factory Theatre',
    status: 'locked',
  },
  {
    id: 'test-night',
    name: 'Rehearsal Night',
    date: '2026-10-07T08:00:00Z',
    location: 'Nowhere',
    status: 'voting',
    is_test: true,
  },
]

/** The list entry for an event: its name heading's surrounding row. */
function eventRow(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { name })
  const row = heading.parentElement?.parentElement
  if (!row) throw new Error(`No row for ${name}`)
  return row
}

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

  describe('event status', () => {
    beforeEach(() => {
      server.use(http.get('/api/events', () => HttpResponse.json(events)))
    })

    it.each([
      ['Test Event 1', 'Voting open'],
      ['Test Event 2', 'Before voting'],
      ['Test Event 3', 'Results released'],
      ['Mid-night Event', 'Voting closed'],
      ['Announcing Event', 'Results locked'],
    ])('labels %s as "%s"', async (name, label) => {
      render(<AdminDashboard session={mockSession} />)

      await screen.findByRole('heading', { name })
      expect(within(eventRow(name)).getByText(label)).toBeInTheDocument()
    })

    it('shows a status it does not know as it is', async () => {
      server.use(
        http.get('/api/events', () =>
          HttpResponse.json([{ ...events[0], status: 'archived' }])
        )
      )
      render(<AdminDashboard session={mockSession} />)

      await screen.findByRole('heading', { name: 'Test Event 1' })
      expect(
        within(eventRow('Test Event 1')).getByText('archived')
      ).toBeInTheDocument()
    })

    it('no longer offers a status picker: status changes go through "Run the night"', async () => {
      render(<AdminDashboard session={mockSession} />)

      await screen.findByRole('heading', { name: 'Test Event 1' })
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })

    it('marks the rehearsal event as a test, and only that one', async () => {
      render(<AdminDashboard session={mockSession} />)

      await screen.findByRole('heading', { name: 'Rehearsal Night' })
      expect(
        within(eventRow('Rehearsal Night')).getByText('Test')
      ).toBeInTheDocument()
      expect(within(eventRow('Test Event 1')).queryByText('Test')).toBeNull()
      expect(screen.getAllByText('Test')).toHaveLength(1)
    })

    it('links each event to its "Run the night" page', async () => {
      render(<AdminDashboard session={mockSession} />)

      await screen.findByRole('heading', { name: 'Rehearsal Night' })
      for (const event of events) {
        expect(
          within(eventRow(event.name)).getByRole('link', {
            name: 'Run the night',
          })
        ).toHaveAttribute('href', `/admin/events/${event.id}/run`)
      }
    })
  })

  it('asks for the event list including the rehearsal event', async () => {
    let requested = ''
    server.use(
      http.get('/api/events', ({ request }) => {
        requested = request.url
        return HttpResponse.json(events)
      })
    )

    render(<AdminDashboard session={mockSession} />)

    await screen.findByRole('heading', { name: 'Rehearsal Night' })
    expect(new URL(requested).searchParams.get('includeTest')).toBe('1')
  })

  describe('Rehearse with test event', () => {
    it('creates (or reuses) the test event and opens its "Run the night" page', async () => {
      const user = userEvent.setup()
      let method = ''
      server.use(
        http.post('/api/admin/test-event', ({ request }) => {
          method = request.method
          return HttpResponse.json({
            event: { id: 'test-night', name: 'Rehearsal Night' },
          })
        })
      )
      render(<AdminDashboard session={mockSession} />)

      await user.click(
        screen.getByRole('button', { name: 'Rehearse with test event' })
      )

      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith('/admin/events/test-night/run')
      )
      expect(method).toBe('POST')
    })

    it('shows that it is working, and cannot be pressed twice', async () => {
      const user = userEvent.setup()
      let calls = 0
      let release: () => void = () => {}
      server.use(
        http.post('/api/admin/test-event', async () => {
          calls++
          await new Promise<void>((resolve) => (release = resolve))
          return HttpResponse.json({ event: { id: 'test-night' } })
        })
      )
      render(<AdminDashboard session={mockSession} />)

      await user.click(
        screen.getByRole('button', { name: 'Rehearse with test event' })
      )

      const busy = await screen.findByRole('button', { name: 'Opening…' })
      expect(busy).toBeDisabled()
      await user.click(busy)
      expect(calls).toBe(1)

      release()
      await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
    })

    it('shows the error and stays put when the test event cannot be created', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/admin/test-event', () =>
          HttpResponse.json(
            { error: 'Failed to create the test event' },
            { status: 500 }
          )
        )
      )
      render(<AdminDashboard session={mockSession} />)

      await user.click(
        screen.getByRole('button', { name: 'Rehearse with test event' })
      )

      expect(
        await screen.findByText('Failed to create the test event')
      ).toBeInTheDocument()
      expect(mockPush).not.toHaveBeenCalled()
      expect(
        screen.getByRole('button', { name: 'Rehearse with test event' })
      ).toBeEnabled()
    })

    it('does not navigate when the response has no event', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/admin/test-event', () => HttpResponse.json({}))
      )
      render(<AdminDashboard session={mockSession} />)

      await user.click(
        screen.getByRole('button', { name: 'Rehearse with test event' })
      )

      expect(
        await screen.findByText('Failed to open the test event')
      ).toBeInTheDocument()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('reports a network failure', async () => {
      const user = userEvent.setup()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      server.use(http.post('/api/admin/test-event', () => HttpResponse.error()))
      render(<AdminDashboard session={mockSession} />)

      await user.click(
        screen.getByRole('button', { name: 'Rehearse with test event' })
      )

      expect(
        await screen.findByText('Failed to open the test event')
      ).toBeInTheDocument()
      expect(mockPush).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
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
