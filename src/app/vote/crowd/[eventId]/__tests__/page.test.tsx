import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { server } from '@/__mocks__/server'
import { http, HttpResponse } from 'msw'
import CrowdVotingPage from '../page'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ eventId: 'test-event-id' }),
}))

// Mock the user context functions
vi.mock('@/lib/user-context-client', () => ({
  getClientUserContext: vi.fn(() => ({
    screen_resolution: '1920x1080',
    timezone: 'America/New_York',
    language: 'en-US',
  })),
  hasVotingCookie: vi.fn(() => false),
  setVotingCookie: vi.fn(),
  getVoteFromCookie: vi.fn(() => null),
  getFingerprintJSData: vi.fn(() =>
    Promise.resolve({
      visitorId: 'test-visitor-id',
      confidence: 0.95,
      components: {},
    })
  ),
}))

describe('CrowdVotingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders crowd voting form', async () => {
    render(<CrowdVotingPage />)

    // Wait for loading to complete
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Crowd Voting' })
      ).toBeInTheDocument()
    })

    expect(screen.getByText('Vote for your favorite band!')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Test Band 1')).toBeInTheDocument()
      expect(screen.getByText('Test Band 2')).toBeInTheDocument()
    })
  })

  it('displays bands with correct information', async () => {
    render(<CrowdVotingPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Band 1')).toBeInTheDocument()
      expect(screen.getByText('A test band')).toBeInTheDocument()
      expect(screen.getByText('Test Band 2')).toBeInTheDocument()
      expect(screen.getByText('Another test band')).toBeInTheDocument()
    })
  })

  it('allows band selection via radio buttons', async () => {
    const user = userEvent.setup()
    render(<CrowdVotingPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Band 1')).toBeInTheDocument()
    })

    const band1Radio = screen.getByRole('radio', { name: /Test Band 1/ })
    const band2Radio = screen.getByRole('radio', { name: /Test Band 2/ })

    expect(band1Radio).not.toBeChecked()
    expect(band2Radio).not.toBeChecked()

    await user.click(band1Radio)
    expect(band1Radio).toBeChecked()
    expect(band2Radio).not.toBeChecked()

    await user.click(band2Radio)
    expect(band1Radio).not.toBeChecked()
    expect(band2Radio).toBeChecked()
  })

  it('submits vote successfully', async () => {
    const user = userEvent.setup()

    render(<CrowdVotingPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Band 1')).toBeInTheDocument()
    })

    const band1Radio = screen.getByRole('radio', { name: /Test Band 1/ })
    await user.click(band1Radio)

    const submitButton = screen.getByRole('button', { name: 'Submit Vote' })
    expect(submitButton).not.toBeDisabled()

    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Vote Submitted!')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Your vote has been recorded. Thank you for participating!'
        )
      ).toBeInTheDocument()
    })
  })

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()

    // Override MSW handler to return a slow response
    server.use(
      http.post('/api/votes', async () => {
        await new Promise((resolve) => setTimeout(resolve, 500))
        return HttpResponse.json({ success: true })
      })
    )

    render(<CrowdVotingPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Band 1')).toBeInTheDocument()
    })

    const band1Radio = screen.getByRole('radio', { name: /Test Band 1/ })
    await user.click(band1Radio)

    const submitButton = screen.getByRole('button', { name: 'Submit Vote' })
    await user.click(submitButton)

    // Wait for loading state to appear
    await waitFor(
      () => {
        expect(screen.getByText('Submitting...')).toBeInTheDocument()
      },
      { timeout: 1000 }
    )
    expect(submitButton).toBeDisabled()
  })

  it('prevents submission without band selection', async () => {
    render(<CrowdVotingPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Band 1')).toBeInTheDocument()
    })

    const submitButton = screen.getByRole('button', { name: 'Submit Vote' })
    expect(submitButton).toBeDisabled()
  })

  it('handles submission error', async () => {
    const user = userEvent.setup()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Override MSW handler to return an error response
    server.use(
      http.post('/api/votes', () => {
        return new HttpResponse(null, { status: 409 })
      })
    )

    render(<CrowdVotingPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Band 1')).toBeInTheDocument()
    })

    const band1Radio = screen.getByRole('radio', { name: /Test Band 1/ })
    await user.click(band1Radio)

    const submitButton = screen.getByRole('button', { name: 'Submit Vote' })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Already Voted')).toBeInTheDocument()
    })

    consoleSpy.mockRestore()
  })

  it('handles fetch bands error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Override MSW handler to return an error response
    server.use(
      http.get('/api/bands/:eventId', () => {
        return new HttpResponse(null, { status: 500 })
      })
    )

    render(<CrowdVotingPage />)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching bands:',
        expect.any(Error)
      )
    })

    consoleSpy.mockRestore()
  })
})
