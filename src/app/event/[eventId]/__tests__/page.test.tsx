import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { EventPageClient } from '../event-page-client'
import type { Event, Band, Video, Photo } from '@/lib/db'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ eventId: 'test-event-id' }),
}))

// Mock next-auth/react
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signOut: vi.fn(),
}))

describe('EventPage', () => {
  const mockEvent: Event = {
    id: 'test-event-id',
    name: 'Test Event',
    date: '2024-12-25T18:30:00Z',
    location: 'Test Venue',
    timezone: 'America/New_York',
    status: 'voting',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  }

  const mockBands: Band[] = [
    {
      id: 'band-1',
      event_id: 'test-event-id',
      name: 'Test Band 1',
      description: 'A test band',
      order: 1,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'band-2',
      event_id: 'test-event-id',
      name: 'Test Band 2',
      description: 'Another test band',
      order: 2,
      created_at: '2024-01-01T00:00:00Z',
    },
  ]

  const mockVideos: Video[] = []
  const mockHeroPhoto: Photo | null = null

  const defaultProps = {
    event: mockEvent,
    bands: mockBands,
    heroPhoto: mockHeroPhoto,
    videos: mockVideos,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders event details', () => {
    render(<EventPageClient {...defaultProps} />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Test Event'
    )
  })

  it('shows status badge correctly', () => {
    render(<EventPageClient {...defaultProps} />)

    expect(screen.getByText('Voting Open')).toBeInTheDocument()
  })

  it('shows voting link for voting status', () => {
    render(<EventPageClient {...defaultProps} />)

    const voteLink = screen.getByRole('link', { name: 'Vote for Bands' })
    expect(voteLink).toBeInTheDocument()
    expect(voteLink).toHaveAttribute('href', '/vote/crowd/test-event-id')
  })

  it('shows results link for finalized status', () => {
    render(
      <EventPageClient
        {...defaultProps}
        event={{ ...mockEvent, status: 'finalized' }}
      />
    )

    const resultsLink = screen.getByRole('link', { name: 'View Results' })
    expect(resultsLink).toBeInTheDocument()
    expect(resultsLink).toHaveAttribute('href', '/results/test-event-id')
  })

  it('displays bands list', () => {
    render(<EventPageClient {...defaultProps} />)

    expect(screen.getByText('2 Bands')).toBeInTheDocument()
    expect(screen.getByText('Test Band 1')).toBeInTheDocument()
    expect(screen.getByText('Test Band 2')).toBeInTheDocument()
  })

  it('shows band order numbers', () => {
    render(<EventPageClient {...defaultProps} />)

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows no bands message when empty', () => {
    render(<EventPageClient {...defaultProps} bands={[]} />)

    expect(
      screen.getByText('No bands registered for this event yet.')
    ).toBeInTheDocument()
  })

  it('shows winner section for 2022.1 finalized events', () => {
    render(
      <EventPageClient
        {...defaultProps}
        event={{
          ...mockEvent,
          status: 'finalized',
          info: { winner: 'Champion Band', scoring_version: '2022.1' },
        }}
      />
    )

    expect(screen.getByText('Champion')).toBeInTheDocument()
    expect(screen.getByText('Champion Band')).toBeInTheDocument()
  })

  it('shows description when provided', () => {
    render(
      <EventPageClient
        {...defaultProps}
        event={{
          ...mockEvent,
          info: { description: 'This is a test event description' },
        }}
      />
    )

    expect(
      screen.getByText('This is a test event description')
    ).toBeInTheDocument()
  })

  it('displays ticket CTA for upcoming events with ticket URL', () => {
    render(
      <EventPageClient
        {...defaultProps}
        event={{
          ...mockEvent,
          status: 'upcoming',
          info: { ticket_url: 'https://tickets.example.com' },
        }}
      />
    )

    // There should be ticket CTAs for upcoming events
    const ticketLinks = screen.getAllByRole('link', { name: /ticket/i })
    expect(ticketLinks.length).toBeGreaterThan(0)
  })
})
