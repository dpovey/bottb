import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/__mocks__/server'
import { http, HttpResponse } from 'msw'
import type { Ballot } from '@/lib/ballot'
import { getVoteFromCookie, hasVotingCookie } from '@/lib/user-context-client'
import CrowdVotingPage from '../page'

const EVENT_ID = 'test-event-id'
const BALLOT_URL = `/api/events/${EVENT_ID}/ballot`
const POLL_MS = 5000
const routeParams = vi.hoisted(() => ({ eventId: 'test-event-id' }))

vi.mock('next/navigation', () => ({
  useParams: () => routeParams,
}))

vi.mock('@/lib/user-context-client', () => ({
  getClientUserContext: vi.fn(() => ({
    screen_resolution: '1920x1080',
    timezone: 'Australia/Sydney',
    language: 'en-AU',
  })),
  hasVotingCookie: vi.fn(() => false),
  getVoteFromCookie: vi.fn(() => null),
  getFingerprintJSData: vi.fn(() =>
    Promise.resolve({
      visitorId: 'test-visitor-id',
      confidence: 0.95,
      components: {},
    })
  ),
}))

function ballot(status: string): Ballot {
  return {
    event: {
      id: EVENT_ID,
      name: 'Sydney 2026',
      status,
      votingOpen: status === 'voting',
    },
    bands: [
      {
        id: 'band-1',
        name: 'Test Band 1',
        order: 1,
        company_name: 'Acme Corp',
      },
      {
        id: 'band-2',
        name: 'Test Band 2',
        order: 2,
        company_name: 'Globex Inc',
      },
    ],
  }
}

/** Serve these ballots in turn (the last one repeats); counts requests. */
function serveBallots(...statuses: string[]) {
  const served = { count: 0 }
  server.use(
    http.get(BALLOT_URL, () => {
      const status = statuses[Math.min(served.count, statuses.length - 1)]
      served.count++
      return HttpResponse.json(ballot(status))
    })
  )
  return served
}

/** Answer votes with these responses in turn (the last one repeats). */
function answerVotes(...responses: (() => Response)[]) {
  const received: Record<string, unknown>[] = []
  server.use(
    http.post('/api/votes', async ({ request }) => {
      received.push((await request.json()) as Record<string, unknown>)
      return responses[Math.min(received.length - 1, responses.length - 1)]()
    })
  )
  return received
}

const ok =
  (status: 'approved' | 'pending' = 'approved') =>
  () =>
    HttpResponse.json(
      { id: 'vote-1', status, duplicateDetected: status === 'pending' },
      { status: status === 'approved' ? 200 : 201 }
    )
const fail =
  (status: number, body: Record<string, unknown> = {}) =>
  () =>
    HttpResponse.json({ error: 'nope', ...body }, { status })

const NOT_THROUGH =
  'We could not confirm your vote. Please check your connection and tap the button again — it will not be counted twice.'

async function voteFor(
  user: ReturnType<typeof userEvent.setup>,
  bandName: string
) {
  await user.click(
    await screen.findByRole('radio', { name: new RegExp(bandName) })
  )
  await user.click(screen.getByRole('button', { name: 'Submit Vote' }))
}

describe('CrowdVotingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    routeParams.eventId = EVENT_ID
    window.localStorage.clear()
    vi.mocked(hasVotingCookie).mockReturnValue(false)
    vi.mocked(getVoteFromCookie).mockReturnValue(null)
    serveBallots('voting')
  })

  describe('what is on screen', () => {
    it('shows the ballot while voting is open', async () => {
      render(<CrowdVotingPage />)

      expect(await screen.findByText('Test Band 1')).toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: 'Crowd Voting' })
      ).toBeInTheDocument()
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
      expect(screen.getByText('Test Band 2')).toBeInTheDocument()
      expect(screen.getByText('Globex Inc')).toBeInTheDocument()
      expect(
        screen.getByRole('radio', { name: /Test Band 1/ })
      ).not.toBeChecked()
      expect(screen.getByLabelText('Email (Optional)')).toBeInTheDocument()
    })

    it('needs a band chosen before the vote can be sent', async () => {
      const user = userEvent.setup()
      render(<CrowdVotingPage />)

      const submit = await screen.findByRole('button', { name: 'Submit Vote' })
      expect(submit).toBeDisabled()

      await user.click(screen.getByRole('radio', { name: /Test Band 2/ }))

      expect(screen.getByRole('radio', { name: /Test Band 2/ })).toBeChecked()
      expect(submit).toBeEnabled()
    })

    it('asks people to wait before voting opens', async () => {
      serveBallots('upcoming')
      render(<CrowdVotingPage />)

      expect(
        await screen.findByRole('heading', { name: 'Voting Opens Soon' })
      ).toBeInTheDocument()
      expect(
        screen.getByText(/Voting for Sydney 2026 has not opened yet/)
      ).toBeInTheDocument()
      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    })

    it.each(['closed', 'locked'])(
      'says voting has closed while the event is %s, without a results link',
      async (status) => {
        serveBallots(status)
        render(<CrowdVotingPage />)

        expect(
          await screen.findByRole('heading', { name: 'Voting Has Closed' })
        ).toBeInTheDocument()
        expect(
          screen.getByText(/results will be announced shortly/)
        ).toBeInTheDocument()
        expect(screen.queryByRole('link')).not.toBeInTheDocument()
        expect(screen.queryByRole('radio')).not.toBeInTheDocument()
      }
    )

    it('links to the results once they are released', async () => {
      serveBallots('finalized')
      render(<CrowdVotingPage />)

      expect(
        await screen.findByRole('heading', { name: 'Voting Has Closed' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('link', { name: 'See the Results' })
      ).toHaveAttribute('href', `/results/${EVENT_ID}`)
    })

    it('says so when the event does not exist', async () => {
      server.use(
        http.get(BALLOT_URL, () =>
          HttpResponse.json({ error: 'Event not found' }, { status: 404 })
        )
      )
      render(<CrowdVotingPage />)

      expect(
        await screen.findByRole('heading', { name: 'Event Not Found' })
      ).toBeInTheDocument()
    })

    it('says it is still trying when the ballot cannot be loaded', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      server.use(
        http.get(BALLOT_URL, () => HttpResponse.json({}, { status: 500 }))
      )
      render(<CrowdVotingPage />)

      expect(
        await screen.findByText('Having trouble connecting. Still trying…')
      ).toBeInTheDocument()
      consoleSpy.mockRestore()
    })

    it('reminds a returning voter of their vote and lets them change it', async () => {
      vi.mocked(hasVotingCookie).mockReturnValue(true)
      vi.mocked(getVoteFromCookie).mockReturnValue({
        bandId: 'band-2',
        bandName: 'Test Band 2',
      })
      render(<CrowdVotingPage />)

      expect(
        await screen.findByText(/You previously voted for/)
      ).toHaveTextContent('You previously voted for Test Band 2')
      expect(screen.getByRole('radio', { name: /Test Band 2/ })).toBeChecked()
      expect(screen.getByRole('button', { name: 'Update Vote' })).toBeEnabled()
    })
  })

  describe('submitting', () => {
    it('sends a crowd vote for the chosen band, with the email if given', async () => {
      const user = userEvent.setup()
      const received = answerVotes(ok())
      render(<CrowdVotingPage />)

      await user.type(
        await screen.findByLabelText('Email (Optional)'),
        'fan@example.com'
      )
      await voteFor(user, 'Test Band 2')

      expect(await screen.findByText('Vote Submitted!')).toBeInTheDocument()
      expect(received).toHaveLength(1)
      expect(received[0]).toMatchObject({
        event_id: EVENT_ID,
        band_id: 'band-2',
        email: 'fan@example.com',
        fingerprintjs_visitor_id: 'test-visitor-id',
      })
    })

    it('leaves the email out when none is given', async () => {
      const user = userEvent.setup()
      const received = answerVotes(ok())
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')

      await screen.findByText('Vote Submitted!')
      expect(received[0]).not.toHaveProperty('email')
    })

    it('thanks the voter when the vote is counted', async () => {
      const user = userEvent.setup()
      answerVotes(ok())
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')

      expect(
        await screen.findByRole('heading', { name: 'Vote Submitted!' })
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Your vote has been recorded. Thank you for participating!'
        )
      ).toBeInTheDocument()
    })

    it('tells the voter a held vote has been received and will be checked', async () => {
      const user = userEvent.setup()
      answerVotes(ok('pending'))
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')

      expect(
        await screen.findByRole('heading', { name: 'Vote Received' })
      ).toBeInTheDocument()
      expect(
        screen.getByText(/double-check it before it is counted/)
      ).toBeInTheDocument()
    })

    it('shows that it is sending, and cannot be sent twice at once', async () => {
      const user = userEvent.setup()
      let release: () => void = () => {}
      const received: unknown[] = []
      server.use(
        http.post('/api/votes', async () => {
          received.push(true)
          await new Promise<void>((resolve) => (release = resolve))
          return ok()()
        })
      )
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')

      const sending = await screen.findByRole('button', {
        name: 'Submitting...',
      })
      expect(sending).toBeDisabled()
      await user.click(sending)
      release()
      expect(await screen.findByText('Vote Submitted!')).toBeInTheDocument()
      expect(received).toHaveLength(1)
    })

    it('says "Already Voted" when the server says this device has voted', async () => {
      const user = userEvent.setup()
      answerVotes(fail(409, { duplicateDetected: true }))
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')

      expect(
        await screen.findByRole('heading', { name: 'Already Voted' })
      ).toBeInTheDocument()
      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    })

    it('switches to "Voting Has Closed" when the vote arrives after voting closed', async () => {
      const user = userEvent.setup()
      answerVotes(fail(403, { eventStatus: 'closed' }))
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')

      expect(
        await screen.findByRole('heading', { name: 'Voting Has Closed' })
      ).toBeInTheDocument()
      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
      expect(screen.queryByText('Already Voted')).not.toBeInTheDocument()
    })

    it('switches to "Voting Opens Soon" when voting was taken back to before voting', async () => {
      const user = userEvent.setup()
      answerVotes(fail(403, { eventStatus: 'upcoming' }))
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')

      expect(
        await screen.findByRole('heading', { name: 'Voting Opens Soon' })
      ).toBeInTheDocument()
    })

    it('says the event is not found when the vote gets a 404', async () => {
      const user = userEvent.setup()
      answerVotes(fail(404))
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')

      expect(
        await screen.findByRole('heading', { name: 'Event Not Found' })
      ).toBeInTheDocument()
    })

    it.each([400, 500, 502])(
      'keeps the ballot usable after a %s, and says the vote did not go through',
      async (status) => {
        const user = userEvent.setup()
        const received = answerVotes(fail(status), ok())
        render(<CrowdVotingPage />)

        await voteFor(user, 'Test Band 1')

        expect(await screen.findByRole('alert')).toHaveTextContent(NOT_THROUGH)
        expect(screen.queryByText('Already Voted')).not.toBeInTheDocument()
        expect(screen.getByRole('radio', { name: /Test Band 1/ })).toBeChecked()

        await user.click(screen.getByRole('button', { name: 'Submit Vote' }))

        expect(await screen.findByText('Vote Submitted!')).toBeInTheDocument()
        expect(received).toHaveLength(2)
      }
    )

    it('keeps the ballot usable after a network failure', async () => {
      const user = userEvent.setup()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      server.use(http.post('/api/votes', () => HttpResponse.error()))
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')

      expect(await screen.findByRole('alert')).toHaveTextContent(NOT_THROUGH)
      expect(screen.queryByText('Already Voted')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Submit Vote' })).toBeEnabled()
      consoleSpy.mockRestore()
    })

    it('still sends the vote when the fingerprint library fails', async () => {
      const user = userEvent.setup()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { getFingerprintJSData } = await import('@/lib/user-context-client')
      vi.mocked(getFingerprintJSData).mockRejectedValueOnce(
        new Error('blocked')
      )
      const received = answerVotes(ok())
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')

      expect(await screen.findByText('Vote Submitted!')).toBeInTheDocument()
      expect(received[0]).not.toHaveProperty('fingerprintjs_visitor_id')
      warnSpy.mockRestore()
    })
  })

  describe("the page's vote id (client_vote_id)", () => {
    const UUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    it('sends the same id with every attempt, and keeps it for the event', async () => {
      const user = userEvent.setup()
      const received = answerVotes(fail(502), ok())
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')
      await screen.findByRole('alert')
      await user.click(screen.getByRole('button', { name: 'Submit Vote' }))
      await screen.findByText('Vote Submitted!')

      expect(received).toHaveLength(2)
      const [first, second] = received.map((body) => body.client_vote_id)
      expect(first).toMatch(UUID)
      expect(second).toBe(first)
      expect(window.localStorage.getItem(`vote_id_${EVENT_ID}`)).toBe(first)
    })

    it('reuses the id already kept for the event (e.g. after a reload)', async () => {
      const kept = '0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e'
      window.localStorage.setItem(`vote_id_${EVENT_ID}`, kept)
      const user = userEvent.setup()
      const received = answerVotes(ok())
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')
      await screen.findByText('Vote Submitted!')

      expect(received[0].client_vote_id).toBe(kept)
    })

    it('uses a different id for a different event', async () => {
      const user = userEvent.setup()
      const received = answerVotes(ok())
      server.use(
        http.get('/api/events/other-event/ballot', () =>
          HttpResponse.json({
            ...ballot('voting'),
            event: { ...ballot('voting').event, id: 'other-event' },
          })
        )
      )
      const { unmount } = render(<CrowdVotingPage />)
      await voteFor(user, 'Test Band 1')
      await screen.findByText('Vote Submitted!')
      unmount()

      routeParams.eventId = 'other-event'
      render(<CrowdVotingPage />)
      await voteFor(user, 'Test Band 2')
      await screen.findByText('Vote Submitted!')

      expect(received).toHaveLength(2)
      expect(received[1].event_id).toBe('other-event')
      expect(received[1].client_vote_id).toMatch(UUID)
      expect(received[1].client_vote_id).not.toBe(received[0].client_vote_id)
      expect(window.localStorage.getItem('vote_id_other-event')).toBe(
        received[1].client_vote_id
      )
    })

    it('still sends the vote, without an id, when storage is blocked', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError')
      })
      const user = userEvent.setup()
      const received = answerVotes(ok())
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')

      expect(await screen.findByText('Vote Submitted!')).toBeInTheDocument()
      expect(received[0]).not.toHaveProperty('client_vote_id')
    })

    it('promises a retry is safe when it could keep an id', async () => {
      const user = userEvent.setup()
      answerVotes(fail(500))
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'We could not confirm your vote. Please check your connection and tap the button again — it will not be counted twice.'
      )
    })

    it('makes no such promise when it could not keep an id', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError')
      })
      const user = userEvent.setup()
      answerVotes(fail(500))
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(
        'We could not confirm your vote. Please check your connection and tap the button again.'
      )
      expect(alert).not.toHaveTextContent(/counted twice/)
    })

    it('makes no such promise after a network failure without an id', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.spyOn(window.crypto, 'randomUUID').mockImplementation(() => {
        throw new Error('not supported')
      })
      const user = userEvent.setup()
      server.use(http.post('/api/votes', () => HttpResponse.error()))
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(/tap the button again\.$/)
      expect(alert).not.toHaveTextContent(/counted twice/)
      consoleSpy.mockRestore()
    })

    it('still sends the vote, without an id, when the browser cannot make one', async () => {
      vi.spyOn(window.crypto, 'randomUUID').mockImplementation(() => {
        throw new Error('not supported')
      })
      const user = userEvent.setup()
      const received = answerVotes(ok())
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')

      expect(await screen.findByText('Vote Submitted!')).toBeInTheDocument()
      expect(received[0]).not.toHaveProperty('client_vote_id')
      expect(window.localStorage.getItem(`vote_id_${EVENT_ID}`)).toBeNull()
    })
  })

  describe('following the night (polling)', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const nextPoll = () =>
      act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_MS)
      })

    it('shows the ballot when a later check says voting has opened', async () => {
      const served = serveBallots('upcoming', 'voting')
      render(<CrowdVotingPage />)
      await screen.findByRole('heading', { name: 'Voting Opens Soon' })

      await nextPoll()

      expect(
        await screen.findByRole('radio', { name: /Test Band 1/ })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('heading', { name: 'Voting Opens Soon' })
      ).not.toBeInTheDocument()
      expect(served.count).toBeGreaterThanOrEqual(2)
    })

    it('replaces the ballot when a later check says voting has closed', async () => {
      serveBallots('voting', 'closed')
      render(<CrowdVotingPage />)
      await screen.findByRole('radio', { name: /Test Band 1/ })

      await nextPoll()

      expect(
        await screen.findByRole('heading', { name: 'Voting Has Closed' })
      ).toBeInTheDocument()
      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    })

    it('recovers from a failed check on the next one', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      let calls = 0
      server.use(
        http.get(BALLOT_URL, () =>
          ++calls === 1
            ? HttpResponse.error()
            : HttpResponse.json(ballot('voting'))
        )
      )
      render(<CrowdVotingPage />)
      await screen.findByText('Having trouble connecting. Still trying…')

      await nextPoll()

      expect(
        await screen.findByRole('radio', { name: /Test Band 1/ })
      ).toBeInTheDocument()
      consoleSpy.mockRestore()
    })

    it.each([
      ['an empty object', () => HttpResponse.json({})],
      [
        'an event but no bands',
        () => HttpResponse.json({ event: ballot('voting').event }),
      ],
      [
        'a page that is not JSON',
        () => HttpResponse.text('<html>Gateway</html>'),
      ],
    ])(
      'treats a 200 with %s as a failed load while loading, then recovers',
      async (_case, malformed) => {
        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {})
        let calls = 0
        server.use(
          http.get(BALLOT_URL, () =>
            ++calls === 1 ? malformed() : HttpResponse.json(ballot('voting'))
          )
        )
        render(<CrowdVotingPage />)

        expect(
          await screen.findByText('Having trouble connecting. Still trying…')
        ).toBeInTheDocument()
        expect(screen.queryByRole('radio')).not.toBeInTheDocument()

        await nextPoll()

        expect(
          await screen.findByRole('radio', { name: /Test Band 1/ })
        ).toBeInTheDocument()
        expect(
          screen.queryByText('Having trouble connecting. Still trying…')
        ).not.toBeInTheDocument()
        consoleSpy.mockRestore()
      }
    )

    it('keeps the ballot on screen, without a connection warning, when a later check returns a malformed 200', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      let calls = 0
      server.use(
        http.get(BALLOT_URL, () =>
          ++calls === 1
            ? HttpResponse.json(ballot('voting'))
            : HttpResponse.json({ ok: true })
        )
      )
      render(<CrowdVotingPage />)
      await screen.findByRole('radio', { name: /Test Band 1/ })

      await nextPoll()

      expect(calls).toBeGreaterThanOrEqual(2)
      expect(
        screen.getByRole('radio', { name: /Test Band 1/ })
      ).toBeInTheDocument()
      expect(
        screen.queryByText('Having trouble connecting. Still trying…')
      ).not.toBeInTheDocument()
      consoleSpy.mockRestore()
    })

    it('keeps the closed screen when a later check returns a malformed 200', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      let calls = 0
      server.use(
        http.get(BALLOT_URL, () =>
          ++calls === 1
            ? HttpResponse.json(ballot('closed'))
            : HttpResponse.json({})
        )
      )
      render(<CrowdVotingPage />)
      await screen.findByRole('heading', { name: 'Voting Has Closed' })

      await nextPoll()

      expect(calls).toBeGreaterThanOrEqual(2)
      expect(
        screen.getByRole('heading', { name: 'Voting Has Closed' })
      ).toBeInTheDocument()
      consoleSpy.mockRestore()
    })

    it('keeps the ballot on screen when a check fails while voting is open', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      let calls = 0
      server.use(
        http.get(BALLOT_URL, () =>
          ++calls === 1
            ? HttpResponse.json(ballot('voting'))
            : HttpResponse.error()
        )
      )
      render(<CrowdVotingPage />)
      await screen.findByRole('radio', { name: /Test Band 1/ })

      await nextPoll()

      expect(calls).toBeGreaterThanOrEqual(2)
      expect(
        screen.getByRole('radio', { name: /Test Band 1/ })
      ).toBeInTheDocument()
      consoleSpy.mockRestore()
    })

    it('stops checking once the vote is in', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const served = serveBallots('voting')
      answerVotes(ok())
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')
      await screen.findByText('Vote Submitted!')
      const checksSoFar = served.count

      await nextPoll()
      await nextPoll()

      expect(served.count).toBe(checksSoFar)
    })

    it('replaces "Event Not Found" when a later check finds the event (e.g. mid-deploy)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      let calls = 0
      server.use(
        http.get(BALLOT_URL, () =>
          ++calls === 1
            ? HttpResponse.json({ error: 'Event not found' }, { status: 404 })
            : HttpResponse.json(ballot('voting'))
        )
      )
      render(<CrowdVotingPage />)
      await screen.findByRole('heading', { name: 'Event Not Found' })

      await nextPoll()

      expect(
        await screen.findByRole('radio', { name: /Test Band 1/ })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('heading', { name: 'Event Not Found' })
      ).not.toBeInTheDocument()
      consoleSpy.mockRestore()
    })

    it('keeps checking while the event is not found', async () => {
      let calls = 0
      server.use(
        http.get(BALLOT_URL, () => {
          calls++
          return HttpResponse.json(
            { error: 'Event not found' },
            { status: 404 }
          )
        })
      )
      render(<CrowdVotingPage />)
      await screen.findByRole('heading', { name: 'Event Not Found' })
      const checksSoFar = calls

      await nextPoll()
      await nextPoll()

      expect(calls).toBe(checksSoFar + 2)
    })

    const advance = (ms: number) =>
      act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
      })

    it('does not start another check while one is still waiting for an answer', async () => {
      let calls = 0
      let answerSecond: () => void = () => {}
      server.use(
        http.get(BALLOT_URL, async () => {
          calls++
          if (calls === 2) {
            // A slow answer that, if a newer check had overtaken it, would
            // put back an out-of-date screen.
            await new Promise<void>((resolve) => (answerSecond = resolve))
            return HttpResponse.json(ballot('upcoming'))
          }
          return HttpResponse.json(ballot(calls === 1 ? 'voting' : 'closed'))
        })
      )
      render(<CrowdVotingPage />)
      await screen.findByRole('radio', { name: /Test Band 1/ })

      await nextPoll() // 5 s: starts the slow second check
      await nextPoll() // 10 s: still waiting (gives up at 13 s), so skipped

      expect(calls).toBe(2)
      expect(
        screen.getByRole('radio', { name: /Test Band 1/ })
      ).toBeInTheDocument()

      await act(async () => {
        answerSecond()
      })
      expect(
        await screen.findByRole('heading', { name: 'Voting Opens Soon' })
      ).toBeInTheDocument()

      // Checks resume once it has answered, and the newest answer wins.
      await nextPoll()
      expect(calls).toBe(3)
      expect(
        await screen.findByRole('heading', { name: 'Voting Has Closed' })
      ).toBeInTheDocument()
    })

    it('gives up on a check that never answers after 8 s, so the next one can run', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      let calls = 0
      server.use(
        http.get(BALLOT_URL, async () => {
          calls++
          if (calls === 1) return HttpResponse.json(ballot('voting'))
          if (calls === 2) await new Promise<never>(() => {}) // stalls
          return HttpResponse.json(ballot('closed'))
        })
      )
      render(<CrowdVotingPage />)
      await screen.findByRole('radio', { name: /Test Band 1/ })

      await nextPoll() // 5 s: second check stalls
      await advance(7900) // 12.9 s: the 10 s tick was skipped
      expect(calls).toBe(2)

      await advance(2200) // 15.1 s: aborted at 13 s, the 15 s tick runs
      expect(calls).toBe(3)
      expect(
        await screen.findByRole('heading', { name: 'Voting Has Closed' })
      ).toBeInTheDocument()
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching ballot:',
        expect.objectContaining({ name: 'AbortError' })
      )
      consoleSpy.mockRestore()
    })

    it('does not stay on "Loading" when the first check never answers', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      let calls = 0
      server.use(
        http.get(BALLOT_URL, async () => {
          if (++calls === 1) await new Promise<never>(() => {})
          return HttpResponse.json(ballot('voting'))
        })
      )
      render(<CrowdVotingPage />)

      await advance(8100)
      expect(
        await screen.findByText('Having trouble connecting. Still trying…')
      ).toBeInTheDocument()

      await advance(2000) // 10 s tick
      expect(
        await screen.findByRole('radio', { name: /Test Band 1/ })
      ).toBeInTheDocument()
      expect(calls).toBe(2)
      consoleSpy.mockRestore()
    })

    it('gives up on a vote that never answers after 15 s; tapping again sends the same vote', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const received: Record<string, unknown>[] = []
      server.use(
        http.post('/api/votes', async ({ request }) => {
          received.push((await request.json()) as Record<string, unknown>)
          if (received.length === 1) await new Promise<never>(() => {})
          return ok()()
        })
      )
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')
      expect(
        await screen.findByRole('button', { name: 'Submitting...' })
      ).toBeDisabled()

      await advance(14_500)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()

      await advance(1000)
      expect(await screen.findByRole('alert')).toHaveTextContent(NOT_THROUGH)
      const submit = screen.getByRole('button', { name: 'Submit Vote' })
      expect(submit).toBeEnabled()
      expect(screen.getByRole('radio', { name: /Test Band 1/ })).toBeChecked()

      await user.click(submit)

      expect(await screen.findByText('Vote Submitted!')).toBeInTheDocument()
      expect(received).toHaveLength(2)
      expect(received[0].client_vote_id).toEqual(expect.any(String))
      expect(received[1].client_vote_id).toBe(received[0].client_vote_id)
      consoleSpy.mockRestore()
    })

    it('sends the vote again by itself when the server is busy (429), then succeeds', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const busy = () =>
        HttpResponse.json(
          { error: 'Too many requests', retryAfter: 1 },
          { status: 429, headers: { 'Retry-After': '1' } }
        )
      const received = answerVotes(busy, ok())
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Lots of votes coming in — sending yours again…'
      )
      expect(received).toHaveLength(1)

      // Retry-After 1 s plus up to 1 s of jitter.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(await screen.findByText('Vote Submitted!')).toBeInTheDocument()
      expect(received).toHaveLength(2)
      expect(received[1]).toMatchObject({ band_id: 'band-1' })
    })

    it.each([
      ['no Retry-After header', undefined],
      ['Retry-After: 0', '0'],
      ['a Retry-After that is not a number', 'soon'],
    ])(
      'waits about two seconds before re-sending when the 429 has %s',
      async (_case, retryAfter) => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        const busy = () =>
          HttpResponse.json(
            { error: 'Too many requests' },
            {
              status: 429,
              headers: retryAfter ? { 'Retry-After': retryAfter } : {},
            }
          )
        const received = answerVotes(busy, ok())
        render(<CrowdVotingPage />)

        await voteFor(user, 'Test Band 1')
        await screen.findByText(
          'Lots of votes coming in — sending yours again…'
        )

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1900)
        })
        expect(received).toHaveLength(1)

        // 2 s plus up to 1 s of jitter.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1200)
        })
        expect(await screen.findByText('Vote Submitted!')).toBeInTheDocument()
        expect(received).toHaveLength(2)
      }
    )

    it('waits at most five seconds (plus jitter) however long Retry-After says', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const busy = () =>
        HttpResponse.json(
          { error: 'Too many requests' },
          { status: 429, headers: { 'Retry-After': '60' } }
        )
      const received = answerVotes(busy, ok())
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')
      await screen.findByText('Lots of votes coming in — sending yours again…')

      await act(async () => {
        await vi.advanceTimersByTimeAsync(4900)
      })
      expect(received).toHaveLength(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1200)
      })
      expect(await screen.findByText('Vote Submitted!')).toBeInTheDocument()
      expect(received).toHaveLength(2)
    })

    it('gives up after four automatic retries and asks for another tap', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const busy = () =>
        HttpResponse.json(
          { error: 'Too many requests' },
          { status: 429, headers: { 'Retry-After': '60' } }
        )
      const received = answerVotes(busy)
      render(<CrowdVotingPage />)

      await voteFor(user, 'Test Band 1')
      await screen.findByText('Lots of votes coming in — sending yours again…')

      // Each wait is capped at 5 s (plus up to 1 s of jitter).
      for (let i = 0; i < 4; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(6000)
        })
      }

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'It is very busy right now and your vote has not gone through yet. Please tap the button again.'
      )
      expect(received).toHaveLength(5)
      expect(screen.queryByText('Already Voted')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Submit Vote' })).toBeEnabled()
    })
  })
})
