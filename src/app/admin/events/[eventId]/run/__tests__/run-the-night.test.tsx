import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getAvailableTransitions,
  type EventStatus,
} from '@/lib/event-lifecycle'
import type {
  NightJudge,
  NightStanding,
  NightState,
  NightTransition,
} from '@/lib/night-types'
import { buildReadOut } from '@/lib/read-out'
import { buildReviewQueue, type ReviewVote } from '@/lib/vote-review'
import { RunTheNight } from '../run-the-night'

const EVENT_ID = 'sydney-2026'
const NIGHT_URL = `/api/events/${EVENT_ID}/night`

// Band names that appear nowhere else in the page's own copy.
const ROCKERS = 'Zephyr Rockets'
const POINTERS = 'Quasar Pointers'

let voteSeq = 0
function vote(overrides: Partial<ReviewVote> = {}): ReviewVote {
  voteSeq++
  return {
    id: `vote-${voteSeq}`,
    band_id: 'b1',
    status: 'approved',
    created_at: new Date(Date.UTC(2026, 9, 8, 9, 0, voteSeq)).toISOString(),
    ip_address: `10.0.0.${voteSeq}`,
    user_agent: 'iPhone Safari',
    browser_name: 'Safari',
    os_name: 'iOS',
    os_version: '18.6',
    device_type: 'Mobile',
    screen_resolution: '390x844',
    fingerprintjs_visitor_id: `fp-${voteSeq}`,
    email: null,
    reviewed_at: null,
    reviewed_by: null,
    ...overrides,
  }
}

/**
 * Earlier approved votes and three held ones:
 * - held-approve-1: an iPhone lookalike on another network (approve)
 * - held-reject-1: the third vote from one Pixel on one home connection (reject)
 * - held-approve-2: a Pixel lookalike on another network (approve)
 */
function heldVotes(): ReviewVote[] {
  voteSeq = 0
  const pixel = {
    fingerprintjs_visitor_id: 'pixel',
    user_agent: 'Pixel Chrome',
  }
  return [
    vote({ fingerprintjs_visitor_id: 'iphone', ip_address: '1.1.1.1' }),
    vote({ ...pixel, ip_address: '2.2.2.2' }),
    vote({ ...pixel, ip_address: '2.2.2.2' }),
    vote({
      id: 'held-approve-1',
      status: 'pending',
      fingerprintjs_visitor_id: 'iphone',
      ip_address: '9.9.9.9',
    }),
    vote({
      ...pixel,
      id: 'held-reject-1',
      status: 'pending',
      band_id: 'b2',
      ip_address: '2.2.2.2',
    }),
    vote({
      ...pixel,
      id: 'held-approve-2',
      status: 'pending',
      ip_address: '8.8.8.8',
    }),
  ]
}

function standing(
  bandId: string,
  name: string,
  rank: number,
  total: number
): NightStanding {
  return {
    band_id: bandId,
    band_name: name,
    rank,
    tiedWithPrevious: false,
    songChoice: 15,
    performance: 15,
    crowdVibe: 15,
    visuals: 15,
    screamOMeter: 0,
    crowdVoteCount: 3,
    crowdVoteScore: 20,
    judgeScore: 60,
    totalScore: total,
  }
}

function judge(name: string, bandsScored = 2): NightJudge {
  return {
    name,
    submittedAt: '2026-10-08T10:00:00Z',
    bandsScored,
    scores: {
      b1: {
        song_choice: 15,
        performance: 14,
        crowd_vibe: 13,
        visuals: 12,
        total: 54,
      },
      b2: {
        song_choice: 11,
        performance: 10,
        crowd_vibe: 9,
        visuals: 8,
        total: 38,
      },
    },
  }
}

interface StateOptions {
  generatedAt?: string
  isTest?: boolean
  blockers?: string[]
  /** Blockers for the back ("undo") steps. */
  backBlockers?: string[]
  warnings?: string[]
  votes?: ReviewVote[]
  judges?: NightJudge[]
  standings?: NightStanding[]
  reviewed?: ReviewVote[]
}

function makeState(
  status: EventStatus,
  options: StateOptions = {}
): NightState {
  const votes = options.votes ?? []
  const frozen = status === 'locked' || status === 'finalized'
  const transitions: NightTransition[] = getAvailableTransitions(status).map(
    (t) => ({
      id: t.id,
      to: t.to,
      direction: t.direction,
      label: t.label,
      effect: t.effect,
      blockers:
        t.direction === 'forward'
          ? (options.blockers ?? [])
          : (options.backBlockers ?? []),
      warnings: t.direction === 'forward' ? (options.warnings ?? []) : [],
    })
  )
  return {
    event: {
      id: EVENT_ID,
      name: 'Sydney 2026',
      date: '2026-10-08T08:00:00Z',
      timezone: 'Australia/Sydney',
      location: 'Factory Theatre',
      status,
      isTest: options.isTest ?? false,
    },
    generatedAt: options.generatedAt ?? '2026-10-08T10:00:00.000Z',
    scoring: {
      version: '2026.2',
      hasDetailedBreakdown: true,
      hasVisuals: true,
      hasScreamOMeter: false,
      crowdVoteMax: 20,
      maxJudgePoints: 80,
    },
    bands: [
      { id: 'b1', name: ROCKERS, order: 1 },
      { id: 'b2', name: POINTERS, order: 2 },
    ],
    crowd: {
      total: { approved: 31, pending: 3, rejected: 2 },
      byBand: {
        b1: { approved: 23, pending: 2, rejected: 1 },
        b2: { approved: 8, pending: 1, rejected: 1 },
      },
      lastVoteAt: '2026-10-08T09:59:50.000Z',
      votesLastMinute: 4,
    },
    reviewQueue: buildReviewQueue(votes),
    reviewed: options.reviewed ?? [],
    judges: options.judges ?? [],
    standings: options.standings ?? [
      standing('b1', ROCKERS, 1, 87.25),
      standing('b2', POINTERS, 2, 61.5),
    ],
    standingsFrozen: frozen,
    frozenMatchesLive: true,
    transitions,
    log: [],
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

type FetchArgs = [input: string, init?: RequestInit]
const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>()

/** Non-GET calls as [url, method, parsed body]. */
function actionCalls(): [string, string, unknown][] {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method && init.method !== 'GET')
    .map(([url, init]) => [
      url,
      init?.method ?? 'GET',
      JSON.parse(String(init?.body)),
    ])
}

function currentStep(): HTMLElement {
  const stepper = screen.getByRole('list', {
    name: 'Progress through the night',
  })
  const current = within(stepper)
    .getAllByRole('listitem')
    .filter((li) => li.getAttribute('aria-current') === 'step')
  expect(current).toHaveLength(1)
  return current[0]
}

describe('RunTheNight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    // Polls never answer unless a test says otherwise.
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('stepper', () => {
    it.each<[EventStatus, string, number]>([
      ['upcoming', 'Before voting', 0],
      ['voting', 'Voting open', 1],
      ['closed', 'Voting closed', 2],
      ['locked', 'Results locked', 3],
      ['finalized', 'Results released', 4],
    ])('marks %s as the current step', (status, label, done) => {
      render(
        <RunTheNight eventId={EVENT_ID} initialState={makeState(status)} />
      )
      expect(currentStep()).toHaveTextContent(label)
      expect(
        screen.getByRole('heading', { level: 2, name: label })
      ).toBeInTheDocument()
      const stepper = screen.getByRole('list', {
        name: 'Progress through the night',
      })
      // Steps before the current one are ticked off.
      expect(within(stepper).queryAllByText('✓')).toHaveLength(done)
    })
  })

  describe('forward step', () => {
    it.each<[EventStatus, string]>([
      ['upcoming', 'Open crowd voting'],
      ['voting', 'Close crowd voting'],
      ['closed', 'Finalise results'],
      ['locked', 'Release results'],
    ])('offers the next step from %s', (status, label) => {
      render(
        <RunTheNight eventId={EVENT_ID} initialState={makeState(status)} />
      )
      expect(screen.getByRole('button', { name: label })).toBeEnabled()
    })

    it('offers no forward step once results are released', () => {
      render(
        <RunTheNight eventId={EVENT_ID} initialState={makeState('finalized')} />
      )
      expect(
        screen.queryByRole('button', { name: 'Release results' })
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Take results down' })
      ).toBeInTheDocument()
    })

    it('disables the button and lists the blockers', async () => {
      const blockers = [
        '2 held votes still need a decision. Approve or reject them first.',
        'No judge scores have been entered.',
      ]
      const user = userEvent.setup()
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { blockers })}
        />
      )
      const button = screen.getByRole('button', { name: 'Finalise results' })
      expect(button).toBeDisabled()
      const list = screen.getByRole('list', { name: 'Before you can continue' })
      for (const blocker of blockers) {
        expect(
          within(list).getByText(blocker, { exact: false })
        ).toBeInTheDocument()
      }
      await user.click(button)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('asks for confirmation naming the event and listing the warnings before doing anything', async () => {
      const warnings = [
        'Only 2 judges have been entered.',
        `${ROCKERS} and ${POINTERS} are level at the top (the same score to two decimal places). Check with the judges before you finalise.`,
      ]
      const user = userEvent.setup()
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { warnings })}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Finalise results' }))

      const dialog = screen.getByRole('dialog', { name: 'Finalise results' })
      expect(within(dialog).getByText('Sydney 2026')).toBeInTheDocument()
      const list = within(dialog).getByRole('list', {
        name: 'Check before you continue',
      })
      expect(
        within(list)
          .getAllByRole('listitem')
          .map((li) => li.textContent)
      ).toEqual(warnings)
      expect(actionCalls()).toEqual([])
    })

    it('does nothing when the confirmation is cancelled', async () => {
      const user = userEvent.setup()
      render(
        <RunTheNight eventId={EVENT_ID} initialState={makeState('voting')} />
      )
      await user.click(
        screen.getByRole('button', { name: 'Close crowd voting' })
      )
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(actionCalls()).toEqual([])
    })

    it('POSTs the transition with the warnings it showed and renders the returned state', async () => {
      const warnings = ['Only 2 judges have been entered.']
      const after = makeState('locked', {
        generatedAt: '2026-10-08T10:00:05.000Z',
      })
      fetchMock.mockImplementation(async (url, init) =>
        init?.method === 'POST'
          ? jsonResponse(200, { state: after })
          : new Promise<Response>(() => {})
      )
      const user = userEvent.setup()
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { warnings })}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Finalise results' }))
      await user.click(
        screen.getByRole('button', { name: 'Yes, finalise results' })
      )

      expect(actionCalls()).toEqual([
        [
          `${NIGHT_URL}/transition`,
          'POST',
          { transition: 'lock-results', acknowledgedWarnings: warnings },
        ],
      ])
      await waitFor(() =>
        expect(currentStep()).toHaveTextContent('Results locked')
      )
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent(
        'Done: results locked.'
      )
      expect(
        screen.getByRole('button', { name: 'Release results' })
      ).toBeInTheDocument()
    })

    it('on a 409 shows the error and still applies the returned state', async () => {
      const newer = makeState('closed', {
        generatedAt: '2026-10-08T10:00:05.000Z',
      })
      fetchMock.mockImplementation(async (_url, init) =>
        init?.method === 'POST'
          ? jsonResponse(409, {
              error:
                'This event is now "Voting closed", so "Close crowd voting" no longer applies. The page has been refreshed.',
              code: 'stale',
              state: newer,
            })
          : new Promise<Response>(() => {})
      )
      const user = userEvent.setup()
      render(
        <RunTheNight eventId={EVENT_ID} initialState={makeState('voting')} />
      )
      await user.click(
        screen.getByRole('button', { name: 'Close crowd voting' })
      )
      await user.click(
        screen.getByRole('button', { name: 'Yes, close crowd voting' })
      )

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'no longer applies'
      )
      expect(currentStep()).toHaveTextContent('Voting closed')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByText(/^Done:/)).not.toBeInTheDocument()
    })

    it('tells the operator when the request never reached the server', async () => {
      fetchMock.mockImplementation(async (_url, init) => {
        if (init?.method === 'POST') throw new TypeError('Failed to fetch')
        return new Promise<Response>(() => {})
      })
      const user = userEvent.setup()
      render(
        <RunTheNight eventId={EVENT_ID} initialState={makeState('voting')} />
      )
      await user.click(
        screen.getByRole('button', { name: 'Close crowd voting' })
      )
      await user.click(
        screen.getByRole('button', { name: 'Yes, close crowd voting' })
      )
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Could not reach the server, so nothing changed.'
      )
      expect(currentStep()).toHaveTextContent('Voting open')
    })

    it('says the admin was signed out on a 401', async () => {
      fetchMock.mockImplementation(async (_url, init) =>
        init?.method === 'POST'
          ? jsonResponse(401, { error: 'Unauthorized - Admin access required' })
          : new Promise<Response>(() => {})
      )
      const user = userEvent.setup()
      render(
        <RunTheNight eventId={EVENT_ID} initialState={makeState('voting')} />
      )
      await user.click(
        screen.getByRole('button', { name: 'Close crowd voting' })
      )
      await user.click(
        screen.getByRole('button', { name: 'Yes, close crowd voting' })
      )
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'You have been signed out.'
      )
    })
  })

  describe('back steps', () => {
    const legacy =
      'These results were finalised before "Run the night" existed. They cannot be taken down or unlocked here, because that would replace the original scores.'

    it('offers a back step that has no blockers', () => {
      render(
        <RunTheNight eventId={EVENT_ID} initialState={makeState('locked')} />
      )
      expect(
        screen.getByRole('button', { name: 'Unlock results' })
      ).toBeEnabled()
    })

    it('does not offer "Take results down" for a past event, and says why', () => {
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('finalized', { backBlockers: [legacy] })}
        />
      )
      expect(
        screen.queryByRole('button', { name: 'Take results down' })
      ).not.toBeInTheDocument()
      expect(screen.getByText(legacy)).toBeInTheDocument()
    })

    it('does not offer "Unlock results" when blocked, but still offers release', () => {
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('locked', { backBlockers: [legacy] })}
        />
      )
      expect(
        screen.queryByRole('button', { name: 'Unlock results' })
      ).not.toBeInTheDocument()
      expect(screen.getByText(legacy)).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Release results' })
      ).toBeEnabled()
    })

    it('shows a blocker shared by several back steps once', () => {
      const state = makeState('voting', { backBlockers: ['Not now.'] })
      render(<RunTheNight eventId={EVENT_ID} initialState={state} />)
      expect(screen.getAllByText('Not now.')).toHaveLength(1)
    })
  })

  describe('scores stay hidden until "Show scores" is ticked', () => {
    function renderLocked() {
      return render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('locked', { votes: heldVotes() })}
        />
      )
    }

    it('keeps band names, tallies, standings and the winner out of the document', () => {
      renderLocked()
      expect(
        screen.queryByText(ROCKERS, { exact: false })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText(POINTERS, { exact: false })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('table', { name: 'Crowd votes by band' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('table', { name: 'Final results' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('87.25', { exact: false })
      ).not.toBeInTheDocument()
      expect(screen.getByText(/The winner is hidden/)).toBeInTheDocument()
      // Per-band tallies (23 / 8 counted) are not shown either.
      expect(screen.queryByText('23')).not.toBeInTheDocument()
      // The held-vote list says it is blind.
      expect(
        screen.getByText('Band hidden so you decide blind')
      ).toBeInTheDocument()
    })

    it('shows them once ticked', async () => {
      const user = userEvent.setup()
      renderLocked()
      const toggle = screen.getByRole('checkbox', { name: /Show scores/ })
      expect(toggle).not.toBeChecked()
      await user.click(toggle)

      // The winner block above the stepper card (the read-out repeats it).
      expect(screen.getByText('Winner', { selector: 'p' })).toBeInTheDocument()
      expect(
        screen.getByText('87.25 points', { selector: 'span' })
      ).toBeInTheDocument()
      const tallies = screen.getByRole('table', { name: 'Crowd votes by band' })
      expect(
        within(tallies).getByRole('row', { name: `${ROCKERS} 23 2 1` })
      ).toBeInTheDocument()
      expect(
        within(tallies).getByRole('row', { name: `${POINTERS} 8 1 1` })
      ).toBeInTheDocument()
      const results = screen.getByRole('table', { name: 'Final results' })
      const rows = within(results).getAllByRole('row').slice(1)
      expect(rows[0]).toHaveTextContent(ROCKERS)
      expect(rows[0]).toHaveTextContent('87.25')
      expect(rows[1]).toHaveTextContent(POINTERS)

      await user.click(toggle)
      expect(
        screen.queryByText(ROCKERS, { exact: false })
      ).not.toBeInTheDocument()
    })

    it('shows "Provisional standings" before results are locked', async () => {
      const user = userEvent.setup()
      render(
        <RunTheNight eventId={EVENT_ID} initialState={makeState('closed')} />
      )
      expect(screen.queryByText(/Winner/)).not.toBeInTheDocument()
      await user.click(screen.getByRole('checkbox', { name: /Show scores/ }))
      expect(
        screen.getByRole('table', { name: 'Provisional standings' })
      ).toBeInTheDocument()
      // No winner is announced from provisional standings.
      expect(screen.queryByText('Winner')).not.toBeInTheDocument()
    })

    it('keeps judge sheets out of view (collapsed) until opened', () => {
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { judges: [judge('Ann')] })}
        />
      )
      // Visually hidden inside a closed <details>.
      for (const name of [ROCKERS, POINTERS]) {
        expect(screen.getByText(name)).not.toBeVisible()
      }
    })

    // Judge sheets are for checking against the paper sheets, so they list the
    // bands; they stay collapsed until someone opens one. Tallies, standings
    // and the winner stay out of the document entirely.
    it('with judge sheets entered, keeps tallies, standings and the winner out and the sheets collapsed', async () => {
      const user = userEvent.setup()
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('locked', {
            judges: [judge('Ann'), judge('Ben')],
          })}
        />
      )
      expect(
        screen.queryByRole('table', { name: 'Crowd votes by band' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('table', { name: 'Final results' })
      ).not.toBeInTheDocument()
      expect(screen.queryByText('Winner')).not.toBeInTheDocument()
      expect(screen.queryByText(/87\.25/)).not.toBeInTheDocument()
      expect(screen.getByText(/The winner is hidden/)).toBeInTheDocument()

      const sheets = screen.getAllByText('Check against the paper sheet')
      expect(sheets).toHaveLength(2)
      for (const summary of sheets) {
        const details = summary.closest('details')
        expect(details).not.toBeNull()
        expect(details).not.toHaveAttribute('open')
      }
      expect(
        screen.getByRole('table', {
          name: 'Scores entered for Ann',
          hidden: true,
        })
      ).not.toBeVisible()

      // Opening a sheet is an explicit action.
      await user.click(sheets[0])
      expect(sheets[0].closest('details')).toHaveAttribute('open')
      expect(
        screen.getByRole('table', { name: 'Scores entered for Ann' })
      ).toBeVisible()
      // ...and it still does not reveal the standings or the winner.
      expect(screen.queryByText('Winner')).not.toBeInTheDocument()
    })
  })

  describe('held votes', () => {
    it('"Follow suggestions" approves then rejects, one batch after the other, with exactly the suggested ids', async () => {
      const first = deferred<Response>()
      const patches: unknown[] = []
      fetchMock.mockImplementation(async (_url, init) => {
        if (init?.method !== 'PATCH') return new Promise<Response>(() => {})
        patches.push(JSON.parse(String(init.body)))
        if (patches.length === 1) return first.promise
        return jsonResponse(200, { updated: 1 })
      })
      const user = userEvent.setup()
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { votes: heldVotes() })}
        />
      )
      await user.click(
        screen.getByRole('button', {
          name: 'Follow suggestions (2 approve · 1 reject)',
        })
      )

      // The reject batch waits for the approve batch to finish.
      expect(patches).toEqual([
        { status: 'approved', voteIds: ['held-approve-1', 'held-approve-2'] },
      ])
      await act(async () => {
        first.resolve(jsonResponse(200, { updated: 2 }))
      })
      await waitFor(() => expect(patches).toHaveLength(2))
      expect(patches[1]).toEqual({
        status: 'rejected',
        voteIds: ['held-reject-1'],
      })
      expect(actionCalls().map(([url, method]) => [url, method])).toEqual([
        [`${NIGHT_URL}/votes`, 'PATCH'],
        [`${NIGHT_URL}/votes`, 'PATCH'],
      ])
    })

    it('says whether a held vote chose the same band as its match, without naming it', () => {
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { votes: heldVotes() })}
        />
      )
      const list = screen.getByRole('list', { name: 'Held votes' })
      const row = (id: string) =>
        within(list)
          .getByRole('button', { name: `Approve held vote ${id}` })
          .closest('li') as HTMLElement
      // held-approve-1 (band 1) matched an earlier band-1 vote.
      const detail = (id: string) =>
        within(row(id)).getByText(/different IP address|same IP address/)
      expect(detail('held-approve-1').textContent).toMatch(/, same choice$/)
      // held-reject-1 (band 2) matched earlier band-1 votes.
      expect(detail('held-reject-1').textContent).toMatch(/, different choice$/)
      expect(within(list).queryByText(ROCKERS, { exact: false })).toBeNull()
      expect(within(list).queryByText(POINTERS, { exact: false })).toBeNull()
    })

    it('stops after a refused batch', async () => {
      fetchMock.mockImplementation(async (_url, init) =>
        init?.method === 'PATCH'
          ? jsonResponse(409, {
              error:
                'Votes cannot be changed while the event is "Results locked".',
            })
          : new Promise<Response>(() => {})
      )
      const user = userEvent.setup()
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { votes: heldVotes() })}
        />
      )
      await user.click(
        screen.getByRole('button', { name: /Follow suggestions/ })
      )
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Votes cannot be changed'
      )
      expect(actionCalls()).toHaveLength(1)
    })

    it('sends only the approve batch when nothing is suggested for rejection', async () => {
      fetchMock.mockImplementation(async (_url, init) =>
        init?.method === 'PATCH'
          ? jsonResponse(200, { updated: 1 })
          : new Promise<Response>(() => {})
      )
      const votes = heldVotes().filter((v) => v.id !== 'held-reject-1')
      const user = userEvent.setup()
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { votes })}
        />
      )
      await user.click(
        screen.getByRole('button', {
          name: 'Follow suggestions (2 approve · 0 reject)',
        })
      )
      await waitFor(() => expect(actionCalls()).toHaveLength(1))
      expect(actionCalls()[0][2]).toEqual({
        status: 'approved',
        voteIds: ['held-approve-1', 'held-approve-2'],
      })
    })

    it('approves or rejects a single held vote', async () => {
      fetchMock.mockImplementation(async (_url, init) =>
        init?.method === 'PATCH'
          ? jsonResponse(200, { updated: 1 })
          : new Promise<Response>(() => {})
      )
      const user = userEvent.setup()
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('voting', { votes: heldVotes() })}
        />
      )
      await user.click(
        screen.getByRole('button', { name: 'Reject held vote held-approve-2' })
      )
      await waitFor(() => expect(actionCalls()).toHaveLength(1))
      expect(actionCalls()[0][2]).toEqual({
        status: 'rejected',
        voteIds: ['held-approve-2'],
      })
    })

    it('"Undo" sends a decided vote back to pending', async () => {
      fetchMock.mockImplementation(async (_url, init) =>
        init?.method === 'PATCH'
          ? jsonResponse(200, { updated: 1 })
          : new Promise<Response>(() => {})
      )
      const decided = vote({
        id: 'decided-1',
        status: 'rejected',
        reviewed_at: '2026-10-08T10:00:00Z',
        reviewed_by: 'admin@example.com',
      })
      const user = userEvent.setup()
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { reviewed: [decided] })}
        />
      )
      await user.click(screen.getByText('Already decided (1)'))
      await user.click(
        screen.getByRole('button', { name: 'Undo decision on vote decided-1' })
      )
      await waitFor(() => expect(actionCalls()).toHaveLength(1))
      expect(actionCalls()[0]).toEqual([
        `${NIGHT_URL}/votes`,
        'PATCH',
        { status: 'pending', voteIds: ['decided-1'] },
      ])
    })

    it.each<EventStatus>(['upcoming', 'locked', 'finalized'])(
      'offers no review buttons while %s',
      (status) => {
        render(
          <RunTheNight
            eventId={EVENT_ID}
            initialState={makeState(status, { votes: heldVotes() })}
          />
        )
        expect(
          screen.queryByRole('button', { name: /Follow suggestions/ })
        ).not.toBeInTheDocument()
        expect(
          screen.queryByRole('button', { name: /^Approve held vote/ })
        ).not.toBeInTheDocument()
      }
    )
  })

  describe('held vote groups', () => {
    const ADDRESS = '5.5.5.5'
    const ADDRESS_DETAIL =
      '5.5.5.5 · 5 votes from this address in all, from 2 kinds of device'

    /**
     * On ADDRESS: one approved and one rejected earlier vote, then three held
     * repeats of the same phone. Elsewhere: one held Pixel lookalike on another
     * network (a group of one).
     */
    function groupedVotes(): ReviewVote[] {
      voteSeq = 0
      const phone = { fingerprintjs_visitor_id: 'iphone', ip_address: ADDRESS }
      return [
        vote({ ...phone }),
        vote({
          ip_address: ADDRESS,
          user_agent: 'Android Chrome',
          status: 'rejected',
        }),
        vote({ fingerprintjs_visitor_id: 'pixel', ip_address: '6.6.6.6' }),
        vote({ ...phone, id: 'addr-1', status: 'pending', band_id: 'b1' }),
        vote({ ...phone, id: 'addr-2', status: 'pending', band_id: 'b2' }),
        vote({
          fingerprintjs_visitor_id: 'pixel',
          ip_address: '7.7.7.7',
          id: 'lone-1',
          status: 'pending',
        }),
        vote({ ...phone, id: 'addr-3', status: 'pending', band_id: 'b1' }),
      ]
    }

    function groupItem(title: string): HTMLElement {
      const outer = screen.getByRole('list', { name: 'Held votes' })
      const heading = within(outer).getByRole('heading', {
        level: 3,
        name: title,
      })
      return heading.closest('li') as HTMLElement
    }

    it('shows each group with its title, detail and rows', () => {
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { votes: groupedVotes() })}
        />
      )
      const address = groupItem('3 held votes from one IP address')
      expect(within(address).getByText(ADDRESS_DETAIL)).toBeInTheDocument()
      const rows = within(address).getByRole('list', {
        name: '3 held votes from one IP address',
      })
      expect(
        within(rows)
          .getAllByRole('button', { name: /^Approve held vote/ })
          .map((b) => b.getAttribute('aria-label'))
      ).toEqual([
        'Approve held vote addr-1',
        'Approve held vote addr-2',
        'Approve held vote addr-3',
      ])

      const lone = groupItem(
        '1 held vote from an identical handset on a different network'
      )
      expect(
        within(lone).getByText('iOS 18.6 · Safari · 390x844', { selector: 'p' })
      ).toBeInTheDocument()
    })

    it('"Approve these 3" sends one batch with exactly that group\'s votes', async () => {
      fetchMock.mockImplementation(async (_url, init) =>
        init?.method === 'PATCH'
          ? jsonResponse(200, { updated: 3 })
          : new Promise<Response>(() => {})
      )
      const user = userEvent.setup()
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { votes: groupedVotes() })}
        />
      )
      await user.click(
        screen.getByRole('button', {
          name: `Approve these 3 (${ADDRESS_DETAIL})`,
        })
      )
      await waitFor(() => expect(actionCalls()).toHaveLength(1))
      expect(actionCalls()).toEqual([
        [
          `${NIGHT_URL}/votes`,
          'PATCH',
          { status: 'approved', voteIds: ['addr-1', 'addr-2', 'addr-3'] },
        ],
      ])
    })

    it('"Reject these 3" sends the same ids as a rejection', async () => {
      fetchMock.mockImplementation(async (_url, init) =>
        init?.method === 'PATCH'
          ? jsonResponse(200, { updated: 3 })
          : new Promise<Response>(() => {})
      )
      const user = userEvent.setup()
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('voting', { votes: groupedVotes() })}
        />
      )
      await user.click(
        screen.getByRole('button', {
          name: `Reject these 3 (${ADDRESS_DETAIL})`,
        })
      )
      await waitFor(() => expect(actionCalls()).toHaveLength(1))
      expect(actionCalls()[0][2]).toEqual({
        status: 'rejected',
        voteIds: ['addr-1', 'addr-2', 'addr-3'],
      })
    })

    it('offers no group buttons for a group of one', () => {
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { votes: groupedVotes() })}
        />
      )
      const lone = groupItem(
        '1 held vote from an identical handset on a different network'
      )
      expect(
        within(lone).queryByRole('button', { name: /these/ })
      ).not.toBeInTheDocument()
      expect(
        within(lone).getByRole('button', { name: 'Approve held vote lone-1' })
      ).toBeInTheDocument()
      expect(
        screen.getAllByRole('button', { name: /^Approve these/ })
      ).toHaveLength(1)
    })

    it.each<EventStatus>(['upcoming', 'locked', 'finalized'])(
      'offers no group buttons while %s',
      (status) => {
        render(
          <RunTheNight
            eventId={EVENT_ID}
            initialState={makeState(status, { votes: groupedVotes() })}
          />
        )
        expect(
          screen.getByRole('heading', {
            name: '3 held votes from one IP address',
          })
        ).toBeInTheDocument()
        expect(
          screen.queryByRole('button', { name: /these 3/ })
        ).not.toBeInTheDocument()
      }
    )

    it('disables the group buttons while a decision is being sent', async () => {
      const pending = deferred<Response>()
      fetchMock.mockImplementation((_url, init) =>
        init?.method === 'PATCH'
          ? pending.promise
          : new Promise<Response>(() => {})
      )
      const user = userEvent.setup()
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { votes: groupedVotes() })}
        />
      )
      const approve = screen.getByRole('button', {
        name: `Approve these 3 (${ADDRESS_DETAIL})`,
      })
      const reject = screen.getByRole('button', {
        name: `Reject these 3 (${ADDRESS_DETAIL})`,
      })
      await user.click(approve)
      expect(approve).toBeDisabled()
      expect(reject).toBeDisabled()
      await act(async () => {
        pending.resolve(jsonResponse(200, { updated: 3 }))
      })
      await waitFor(() => expect(reject).toBeEnabled())
    })

    it('titles a group whose earlier match has gone accordingly', () => {
      voteSeq = 0
      const votes = [
        vote({
          id: 'orphan-1',
          fingerprintjs_visitor_id: 'gone-phone',
          status: 'pending',
        }),
      ]
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { votes })}
        />
      )
      expect(
        groupItem('1 held vote whose earlier match is no longer there')
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('heading', { name: /identical handset/ })
      ).not.toBeInTheDocument()
    })

    it('keeps the "identical handset" title when any vote in the group matched', () => {
      voteSeq = 0
      // The first held vote's match has gone; the second matches the first.
      const votes = [
        vote({
          id: 'h-1',
          fingerprintjs_visitor_id: 'pixel',
          status: 'pending',
        }),
        vote({
          id: 'h-2',
          fingerprintjs_visitor_id: 'pixel',
          status: 'pending',
        }),
      ]
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { votes })}
        />
      )
      expect(
        groupItem(
          '2 held votes from an identical handset on different networks'
        )
      ).toBeInTheDocument()
    })

    it('names the shared network in the detail', () => {
      const votes = groupedVotes()
      // A third kind of device on the address makes it a shared network.
      votes.push(
        vote({ ip_address: ADDRESS, user_agent: 'Firefox', status: 'approved' })
      )
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { votes })}
        />
      )
      const address = groupItem('3 held votes from one IP address')
      expect(
        within(address).getByText(
          '5.5.5.5 · 6 votes from this address in all, from 3 kinds of device — looks like a shared network (venue Wi-Fi or a mobile carrier)'
        )
      ).toBeInTheDocument()
    })

    it('shows the email address for an email group', () => {
      voteSeq = 0
      const votes = [
        vote({ email: 'sam@example.com' }),
        vote({ id: 'mail-1', email: 'SAM@example.com', status: 'pending' }),
        vote({ id: 'mail-2', email: 'sam@example.com ', status: 'pending' }),
      ]
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { votes })}
        />
      )
      const group = groupItem('2 held votes with an email address already used')
      expect(
        within(group).getByText('sam@example.com', { selector: 'p' })
      ).toBeInTheDocument()
      expect(
        within(group).getByRole('button', {
          name: 'Approve these 2 (sam@example.com)',
        })
      ).toBeInTheDocument()
    })

    it('never puts a band name in a group title or detail with "Show scores" off', () => {
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { votes: groupedVotes() })}
        />
      )
      const outer = screen.getByRole('list', { name: 'Held votes' })
      expect(within(outer).queryByText(ROCKERS, { exact: false })).toBeNull()
      expect(within(outer).queryByText(POINTERS, { exact: false })).toBeNull()
      for (const button of within(outer).getAllByRole('button')) {
        expect(button.getAttribute('aria-label') ?? '').not.toMatch(
          new RegExp(`${ROCKERS}|${POINTERS}`)
        )
      }
    })
  })

  describe('read-out for the MC', () => {
    const THIRD = 'Null Pointer Sisters'
    const FOURTH = 'Merge Conflict'

    /** Four bands, all judged the same except the totals; equal crowd votes. */
    function fourBands(): NightStanding[] {
      return [
        standing('b1', ROCKERS, 1, 87.25),
        standing('b2', POINTERS, 2, 61.5),
        standing('b3', THIRD, 3, 55),
        standing('b4', FOURTH, 4, 40),
      ].map((s, i) => ({
        ...s,
        // Distinct judge scores so no award is shared, and every award goes
        // to the winner.
        songChoice: 18 - i,
        performance: 18 - i,
        crowdVibe: 18 - i,
        visuals: 18 - i,
        judgeScore: 72 - 4 * i,
      }))
    }

    async function showScores(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('checkbox', { name: /Show scores/ }))
    }

    function headings(): string[] {
      const list = screen.getByRole('list', { name: 'Read-out' })
      return within(list)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent ?? '')
    }

    it('mentions the read-out on the "Show scores" toggle', () => {
      render(
        <RunTheNight eventId={EVENT_ID} initialState={makeState('locked')} />
      )
      expect(
        screen.getByRole('checkbox', { name: /the read-out/ })
      ).toBeInTheDocument()
    })

    it('is never shown from provisional standings, even with "Show scores" on', async () => {
      const user = userEvent.setup()
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { standings: fourBands() })}
        />
      )
      await showScores(user)
      expect(
        screen.getByRole('table', { name: 'Provisional standings' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('heading', { name: 'Read-out for the MC' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('list', { name: 'Read-out' })
      ).not.toBeInTheDocument()
      expect(screen.queryByText(/And the winner of/)).not.toBeInTheDocument()
    })

    it('is not in the document for locked results while "Show scores" is off', () => {
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('locked', { standings: fourBands() })}
        />
      )
      expect(
        screen.queryByRole('heading', { name: 'Read-out for the MC' })
      ).not.toBeInTheDocument()
      expect(screen.queryByText(/And the winner of/)).not.toBeInTheDocument()
    })

    it.each<EventStatus>(['locked', 'finalized'])(
      'reads third, second, then the winner once %s',
      async (status) => {
        const user = userEvent.setup()
        render(
          <RunTheNight
            eventId={EVENT_ID}
            initialState={makeState(status, {
              standings: fourBands().map((s) => ({ ...s, crowdVoteCount: 0 })),
            })}
          />
        )
        await showScores(user)
        expect(
          screen.getByRole('heading', { name: 'Read-out for the MC' })
        ).toBeInTheDocument()
        expect(headings()).toEqual(['Third place', 'Second place', 'Winner'])
        const list = screen.getByRole('list', { name: 'Read-out' })
        const sections = within(list).getAllByRole('listitem')
        expect(sections[2]).toHaveTextContent(
          `And the winner of Sydney 2026, with 87.25 points: ${ROCKERS}!`
        )
        expect(sections[0]).toHaveTextContent(
          `In third place, with 55 points: ${THIRD}.`
        )
        // The fourth-placed band is not read out.
        expect(within(list).queryByText(FOURTH, { exact: false })).toBeNull()
      }
    )

    it('announces an award won outside the top three first', async () => {
      const standings = fourBands().map((s) => ({
        ...s,
        crowdVoteCount: s.band_id === 'b4' ? 40 : 10,
      }))
      const user = userEvent.setup()
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('locked', { standings })}
        />
      )
      await showScores(user)
      expect(headings()).toEqual([
        'Other awards',
        'Third place',
        'Second place',
        'Winner',
      ])
      const first = within(
        screen.getByRole('list', { name: 'Read-out' })
      ).getAllByRole('listitem')[0]
      expect(first).toHaveTextContent(`The popular vote goes to ${FOURTH}.`)
    })

    it('flags a tie on the podium with a note', async () => {
      const standings = fourBands()
      standings[1] = {
        ...standings[1],
        totalScore: 87.25,
        tiedWithPrevious: true,
      }
      const user = userEvent.setup()
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('locked', { standings })}
        />
      )
      await showScores(user)
      expect(screen.getByRole('note')).toHaveTextContent(
        `${ROCKERS} and ${POINTERS} are level on 87.25 points.`
      )
    })

    it('copies exactly the read-out text and says so', async () => {
      const standings = fourBands()
      const user = userEvent.setup()
      const writeText = vi
        .spyOn(navigator.clipboard, 'writeText')
        .mockResolvedValue(undefined)
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('locked', { standings })}
        />
      )
      await showScores(user)
      await user.click(screen.getByRole('button', { name: 'Copy text' }))

      const expected = buildReadOut(standings, '2026.2', 'Sydney 2026').text
      expect(writeText).toHaveBeenCalledTimes(1)
      expect(writeText).toHaveBeenCalledWith(expected)
      expect(expected).toContain(
        `And the winner of Sydney 2026, with 87.25 points: ${ROCKERS}!`
      )
      expect(
        await screen.findByRole('button', { name: 'Copied' })
      ).toBeInTheDocument()
    })

    it('offers a fallback when the clipboard refuses', async () => {
      const user = userEvent.setup()
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
        new Error('Not allowed')
      )
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('locked', { standings: fourBands() })}
        />
      )
      await showScores(user)
      await user.click(screen.getByRole('button', { name: 'Copy text' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Could not copy. Select the text below instead.'
      )
      expect(
        screen.getByRole('button', { name: 'Copy text' })
      ).toBeInTheDocument()
    })
  })

  describe('judge sheets', () => {
    it('asks for confirmation before deleting a sheet', async () => {
      fetchMock.mockImplementation(async (_url, init) =>
        init?.method === 'DELETE'
          ? jsonResponse(200, { deleted: 2 })
          : new Promise<Response>(() => {})
      )
      const user = userEvent.setup()
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { judges: [judge('Ann Smith')] })}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Delete sheet' }))

      const dialog = screen.getByRole('dialog', { name: 'Delete judge sheet' })
      expect(dialog).toHaveTextContent('Ann Smith')
      expect(actionCalls()).toEqual([])

      await user.click(
        within(dialog).getByRole('button', { name: 'Yes, delete sheet' })
      )
      await waitFor(() => expect(actionCalls()).toHaveLength(1))
      expect(actionCalls()[0]).toEqual([
        `${NIGHT_URL}/judges`,
        'DELETE',
        { name: 'Ann Smith' },
      ])
      expect(
        await screen.findByText('Deleted the sheet for Ann Smith.')
      ).toBeInTheDocument()
    })

    it('deletes nothing when the confirmation is cancelled', async () => {
      const user = userEvent.setup()
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { judges: [judge('Ann Smith')] })}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Delete sheet' }))
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(actionCalls()).toEqual([])
    })

    it('flags an incomplete sheet', () => {
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { judges: [judge('Ann', 1)] })}
        />
      )
      expect(screen.getByText('1/2 bands')).toBeInTheDocument()
    })

    it.each<EventStatus>(['locked', 'finalized'])(
      'offers no delete once %s',
      (status) => {
        render(
          <RunTheNight
            eventId={EVENT_ID}
            initialState={makeState(status, { judges: [judge('Ann')] })}
          />
        )
        expect(
          screen.queryByRole('button', { name: 'Delete sheet' })
        ).not.toBeInTheDocument()
      }
    )
  })

  describe('rehearsal tools', () => {
    it('are not shown for a real event', () => {
      render(
        <RunTheNight eventId={EVENT_ID} initialState={makeState('voting')} />
      )
      expect(
        screen.queryByRole('heading', { name: 'Rehearsal tools' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Reset test event' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /simulated/ })
      ).not.toBeInTheDocument()
    })

    it('are shown for the test event', () => {
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('voting', { isTest: true })}
        />
      )
      expect(
        screen.getByRole('heading', { name: 'Rehearsal tools' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Add 40 simulated crowd votes' })
      ).toBeEnabled()
      expect(
        screen.getByRole('button', { name: 'Reset test event' })
      ).toBeEnabled()
    })

    it('only allows simulated crowd votes while voting is open', () => {
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('closed', { isTest: true })}
        />
      )
      expect(
        screen.getByRole('button', { name: 'Add 40 simulated crowd votes' })
      ).toBeDisabled()
    })

    it('asks before resetting', async () => {
      fetchMock.mockImplementation(async (_url, init) =>
        init?.method === 'POST'
          ? jsonResponse(200, {
              message: 'Test event reset. All votes and scores are gone.',
            })
          : new Promise<Response>(() => {})
      )
      const user = userEvent.setup()
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('voting', { isTest: true })}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Reset test event' }))
      expect(actionCalls()).toEqual([])
      await user.click(
        screen.getByRole('button', { name: 'Yes, reset test event' })
      )
      await waitFor(() =>
        expect(actionCalls()).toEqual([
          [`${NIGHT_URL}/test`, 'POST', { action: 'reset' }],
        ])
      )
    })
  })

  describe('polling', () => {
    beforeEach(() => {
      // Only the poll interval is faked, so userEvent and waitFor still run.
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    })

    async function tick(ms = 4000) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
      })
    }

    it('polls every 4 seconds', async () => {
      fetchMock.mockImplementation(async () =>
        jsonResponse(200, makeState('voting'))
      )
      render(
        <RunTheNight eventId={EVENT_ID} initialState={makeState('voting')} />
      )
      await tick(3999)
      expect(fetchMock).not.toHaveBeenCalled()
      await tick(1)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0][0]).toBe(NIGHT_URL)
      await tick()
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('shows "Not connected" after a failed poll and clears it after a good one', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(500, { error: 'boom' }))
        .mockResolvedValueOnce(
          jsonResponse(
            200,
            makeState('voting', { generatedAt: '2026-10-08T10:00:08.000Z' })
          )
        )
      render(
        <RunTheNight eventId={EVENT_ID} initialState={makeState('voting')} />
      )
      expect(screen.queryByText(/Not connected/)).not.toBeInTheDocument()

      await tick()
      expect(screen.getByText(/Not connected/)).toBeInTheDocument()

      await tick()
      expect(screen.queryByText(/Not connected/)).not.toBeInTheDocument()
    })

    it('says the admin was signed out when a poll answers 401', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(401, { error: 'Unauthorized - Admin access required' })
      )
      render(
        <RunTheNight eventId={EVENT_ID} initialState={makeState('voting')} />
      )
      await tick()
      expect(screen.getByRole('alert')).toHaveTextContent(
        'You have been signed out.'
      )
      // It replaces the generic banner: signing in again is what fixes it.
      expect(screen.queryByText(/Not connected/)).not.toBeInTheDocument()
    })

    it('clears the signed-out message once a poll succeeds again', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(401, { error: 'Unauthorized - Admin access required' })
      )
      render(
        <RunTheNight eventId={EVENT_ID} initialState={makeState('voting')} />
      )
      await tick()
      expect(screen.getByText(/signed out/)).toBeInTheDocument()

      fetchMock.mockResolvedValueOnce(jsonResponse(200, makeState('voting')))
      await tick()
      expect(screen.queryByText(/signed out/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Not connected/)).not.toBeInTheDocument()
    })

    it('does not say "signed out" for other failed polls', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: 'boom' }))
      render(
        <RunTheNight eventId={EVENT_ID} initialState={makeState('voting')} />
      )
      await tick()
      expect(screen.getByText(/Not connected/)).toBeInTheDocument()
      expect(screen.queryByText(/signed out/)).not.toBeInTheDocument()
    })

    it('treats a network error as "Not connected" too', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      render(
        <RunTheNight eventId={EVENT_ID} initialState={makeState('voting')} />
      )
      await tick()
      expect(screen.getByText(/Not connected/)).toBeInTheDocument()
    })

    it('applies newer state from a poll', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          200,
          makeState('closed', { generatedAt: '2026-10-08T10:00:04.000Z' })
        )
      )
      render(
        <RunTheNight eventId={EVENT_ID} initialState={makeState('voting')} />
      )
      await tick()
      expect(currentStep()).toHaveTextContent('Voting closed')
    })

    it('never lets an older snapshot overwrite newer state', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          200,
          makeState('upcoming', { generatedAt: '2026-10-08T09:59:59.000Z' })
        )
      )
      render(
        <RunTheNight
          eventId={EVENT_ID}
          initialState={makeState('voting', {
            generatedAt: '2026-10-08T10:00:00.000Z',
          })}
        />
      )
      await tick()
      expect(currentStep()).toHaveTextContent('Voting open')
    })

    it('a slow poll that answers after an action never undoes the action', async () => {
      const slowPoll = deferred<Response>()
      const afterClose = makeState('closed', {
        generatedAt: '2026-10-08T10:00:06.000Z',
      })
      fetchMock.mockImplementation(async (_url, init) =>
        init?.method === 'POST'
          ? jsonResponse(200, { state: afterClose })
          : slowPoll.promise
      )
      const user = userEvent.setup()
      render(
        <RunTheNight eventId={EVENT_ID} initialState={makeState('voting')} />
      )

      // A poll starts (snapshot taken at 10:00:04) but is slow to answer.
      await tick()
      expect(fetchMock).toHaveBeenCalledTimes(1)

      // Meanwhile the operator closes voting.
      await user.click(
        screen.getByRole('button', { name: 'Close crowd voting' })
      )
      await user.click(
        screen.getByRole('button', { name: 'Yes, close crowd voting' })
      )
      await waitFor(() =>
        expect(currentStep()).toHaveTextContent('Voting closed')
      )

      // The slow poll finally answers with the older snapshot.
      await act(async () => {
        slowPoll.resolve(
          jsonResponse(
            200,
            makeState('voting', { generatedAt: '2026-10-08T10:00:04.000Z' })
          )
        )
      })
      await tick(0)
      expect(currentStep()).toHaveTextContent('Voting closed')
    })
  })
})
