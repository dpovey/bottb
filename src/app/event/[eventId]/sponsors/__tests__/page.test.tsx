import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import EventSponsorsPage from '../page'

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() })),
  useSearchParams: vi.fn(() => ({ get: vi.fn(() => null) })),
}))

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
  signOut: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  getEventById: vi.fn(),
}))

vi.mock('@/lib/nav-data', () => ({
  getNavEvents: vi.fn(async () => ({ upcoming: [], past: [] })),
}))

import { getEventById } from '@/lib/db'
import { notFound } from 'next/navigation'

const mockGetEventById = getEventById as unknown as ReturnType<typeof vi.fn>
const mockNotFound = notFound as unknown as ReturnType<typeof vi.fn>

const params = Promise.resolve({ eventId: 'brisbane-2026' })

const eventWithDonors = {
  id: 'brisbane-2026',
  name: 'Brisbane 2026',
  date: '2026-08-27T18:30:00+10:00',
  location: 'The Triffid',
  timezone: 'Australia/Brisbane',
  is_active: false,
  status: 'finalized' as const,
  created_at: '2026-01-01T00:00:00Z',
  info: {
    raffle_raised: '$3,000',
    prize_donors: [
      {
        name: 'Reading Cinemas',
        suburb: 'Newmarket',
        link: 'https://www.linkedin.com/company/reading-entertainment-australia-pty-ltd/',
      },
      // Stands for any donor whose URL we could not verify. Kept generic so
      // the case survives a real donor later gaining a website.
      { name: 'A Donor With No Website', suburb: 'Woolloongabba' },
    ],
  },
}

describe('EventSponsorsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('credits each donor with its suburb', async () => {
    mockGetEventById.mockResolvedValue(eventWithDonors)

    render(await EventSponsorsPage({ params }))

    expect(screen.getByText('Reading Cinemas')).toBeInTheDocument()
    expect(screen.getByText('Newmarket')).toBeInTheDocument()
    expect(screen.getByText('A Donor With No Website')).toBeInTheDocument()
    expect(screen.getByText('Woolloongabba')).toBeInTheDocument()
  })

  it('shows the raffle total', async () => {
    mockGetEventById.mockResolvedValue(eventWithDonors)

    render(await EventSponsorsPage({ params }))

    expect(screen.getByText('$3,000')).toBeInTheDocument()
  })

  it('links a donor that has a link and leaves the others unlinked', async () => {
    mockGetEventById.mockResolvedValue(eventWithDonors)

    render(await EventSponsorsPage({ params }))

    const link = screen.getByRole('link', { name: /Visit Reading Cinemas/ })
    expect(link).toHaveAttribute(
      'href',
      'https://www.linkedin.com/company/reading-entertainment-australia-pty-ltd/'
    )

    // A donor with no verified URL must render as plain text rather than
    // guessing one.
    expect(
      screen.queryByRole('link', { name: /Visit A Donor With No Website/ })
    ).not.toBeInTheDocument()
  })

  it('404s for an event with no prize donors', async () => {
    mockGetEventById.mockResolvedValue({
      ...eventWithDonors,
      info: { image_url: 'https://example.com/hero.jpg' },
    })

    await expect(EventSponsorsPage({ params })).rejects.toThrow(
      'NEXT_NOT_FOUND'
    )
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('404s for an unknown event', async () => {
    mockGetEventById.mockResolvedValue(null)

    await expect(EventSponsorsPage({ params })).rejects.toThrow(
      'NEXT_NOT_FOUND'
    )
    expect(mockNotFound).toHaveBeenCalled()
  })
})
