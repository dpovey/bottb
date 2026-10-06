import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../sql', () => ({ sql: vi.fn(), sqlQuery: vi.fn() }))

// The pure standings maths is real; everything that touches the database is
// mocked.
vi.mock('../db', async () => {
  const results =
    await vi.importActual<typeof import('../db/results')>('../db/results')
  return {
    calculateStandings: results.calculateStandings,
    getTiedForFirst: results.getTiedForFirst,
    getEventById: vi.fn(),
    getBandsForEvent: vi.fn(),
    getBandScores: vi.fn(),
    getFinalizedResults: vi.fn(),
    finalizeEventResults: vi.fn(),
    deleteFinalizedResults: vi.fn(),
  }
})

vi.mock('../db/night', () => ({
  getCrowdVotesForReview: vi.fn(),
  getEventStatusLog: vi.fn(),
  getJudgeScores: vi.fn(),
  getOtherEventsVoting: vi.fn(),
  logEventTransition: vi.fn(),
  transitionEventStatus: vi.fn(),
  wasLockedByRunTheNight: vi.fn(),
}))

import {
  deleteFinalizedResults,
  finalizeEventResults,
  getBandScores,
  getBandsForEvent,
  getEventById,
  getFinalizedResults,
  type BandScoreRow,
} from '../db'
import {
  getCrowdVotesForReview,
  getEventStatusLog,
  getJudgeScores,
  getOtherEventsVoting,
  logEventTransition,
  transitionEventStatus,
  wasLockedByRunTheNight,
  type EventStatusLogEntry,
  type JudgeScoreRow,
} from '../db/night'
import type { Band, Event, FinalizedResult } from '../db-types'
import type { EventStatus, TransitionId } from '../event-lifecycle'
import {
  getNightState,
  getPathsToRevalidate,
  performTransition,
} from '../night'
import type { ReviewVote } from '../vote-review'

const EVENT_ID = 'sydney-2026'

/** The "database" the mocks read from and write to. */
interface World {
  exists: boolean
  status: string
  scoringVersion: string
  info: Record<string, unknown>
  isTest: boolean
  bands: Band[]
  scores: BandScoreRow[]
  votes: ReviewVote[]
  judges: JudgeScoreRow[]
  frozen: FinalizedResult[]
  log: EventStatusLogEntry[]
  otherVoting: string[]
  /** The audit log has a "lock-results" entry for this event. */
  lockedByRunTheNight: boolean
}

let world: World

function band(id: string, name: string, order: number): Band {
  return {
    id,
    event_id: EVENT_ID,
    name,
    order,
    created_at: '2026-01-01T00:00:00Z',
  }
}

function scoreRow(
  id: string,
  name: string,
  judgeEach: number,
  crowd: number
): BandScoreRow {
  const avg = `${judgeEach}.0000000000000000`
  return {
    id,
    name,
    order: 1,
    avg_song_choice: avg,
    avg_performance: avg,
    avg_crowd_vibe: avg,
    avg_visuals: avg,
    avg_crowd_vote: null,
    crowd_vote_count: String(crowd),
    judge_vote_count: '3',
    total_crowd_votes: '4',
    crowd_noise_energy: null,
    crowd_noise_peak: null,
    crowd_score: null,
  }
}

let voteSeq = 0
function crowdVote(
  bandId: string,
  overrides: Partial<ReviewVote> = {}
): ReviewVote {
  voteSeq++
  return {
    id: `v-${String(voteSeq).padStart(3, '0')}`,
    band_id: bandId,
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

function judgeRow(name: string, bandId: string, each: number): JudgeScoreRow {
  return {
    id: `j-${name}-${bandId}`,
    name,
    band_id: bandId,
    song_choice: each,
    performance: each,
    crowd_vibe: each,
    visuals: each,
    created_at: '2026-10-08T10:00:00Z',
  }
}

/** Postgres numerics arrive as strings; the type says number. */
function num(value: string): number {
  return value as unknown as number
}

function frozenRow(
  bandId: string,
  name: string,
  rank: number,
  total: string,
  crowdCount: number
): FinalizedResult {
  return {
    id: `f-${bandId}`,
    event_id: EVENT_ID,
    band_id: bandId,
    band_name: name,
    final_rank: rank,
    avg_song_choice: num('15.00'),
    avg_performance: num('15.00'),
    avg_crowd_vibe: num('15.00'),
    avg_visuals: num('15.00'),
    crowd_vote_count: crowdCount,
    judge_vote_count: 3,
    total_crowd_votes: 4,
    crowd_noise_energy: null,
    crowd_noise_peak: null,
    crowd_noise_score: null,
    judge_score: num('60.00'),
    crowd_score: num('20.00'),
    visuals_score: num('15.00'),
    total_score: num(total),
    finalized_at: '2026-10-08T11:00:00Z',
  }
}

/**
 * Scoring 2026.2. Alpha: judges 15 each (60) + 3 crowd votes (leader, 20) = 80.
 * Bravo: judges 10 each (40) + 1 crowd vote (1/3 × 20 = 6.67) = 46.67.
 * Three judges have scored both bands; no held votes. Ready to finalise.
 */
function readyWorld(status: EventStatus): World {
  voteSeq = 0
  return {
    exists: true,
    status,
    scoringVersion: '2026.2',
    info: {},
    isTest: false,
    bands: [band('b1', 'Alpha', 1), band('b2', 'Bravo', 2)],
    scores: [scoreRow('b1', 'Alpha', 15, 3), scoreRow('b2', 'Bravo', 10, 1)],
    votes: [crowdVote('b1'), crowdVote('b1'), crowdVote('b1'), crowdVote('b2')],
    judges: ['Ann', 'Ben', 'Cat'].flatMap((name) => [
      judgeRow(name, 'b1', 15),
      judgeRow(name, 'b2', 10),
    ]),
    frozen: [
      frozenRow('b1', 'Alpha', 1, '80.00', 3),
      frozenRow('b2', 'Bravo', 2, '46.67', 1),
    ],
    log: [],
    otherVoting: [],
    lockedByRunTheNight: true,
  }
}

function eventRow(): Event {
  return {
    id: EVENT_ID,
    name: 'Sydney 2026',
    date: '2026-10-08T08:00:00Z',
    location: 'Factory Theatre',
    timezone: 'Australia/Sydney',
    created_at: '2026-01-01T00:00:00Z',
    is_active: true,
    status: world.status as EventStatus,
    is_test: world.isTest,
    info: {
      scoring_version: world.scoringVersion,
      ...world.info,
    } as Event['info'],
  }
}

const mocks = {
  getEventById: vi.mocked(getEventById),
  getBandsForEvent: vi.mocked(getBandsForEvent),
  getBandScores: vi.mocked(getBandScores),
  getFinalizedResults: vi.mocked(getFinalizedResults),
  finalizeEventResults: vi.mocked(finalizeEventResults),
  deleteFinalizedResults: vi.mocked(deleteFinalizedResults),
  getCrowdVotesForReview: vi.mocked(getCrowdVotesForReview),
  getEventStatusLog: vi.mocked(getEventStatusLog),
  getJudgeScores: vi.mocked(getJudgeScores),
  getOtherEventsVoting: vi.mocked(getOtherEventsVoting),
  logEventTransition: vi.mocked(logEventTransition),
  transitionEventStatus: vi.mocked(transitionEventStatus),
  wasLockedByRunTheNight: vi.mocked(wasLockedByRunTheNight),
}

function wireMocks() {
  // Typed as always finding the event; returns null at runtime when it does not.
  mocks.getEventById.mockImplementation(
    async () => (world.exists ? eventRow() : null) as Event
  )
  mocks.getBandsForEvent.mockImplementation(async () => world.bands)
  mocks.getBandScores.mockImplementation(async () => world.scores)
  mocks.getFinalizedResults.mockImplementation(async () => world.frozen)
  mocks.getCrowdVotesForReview.mockImplementation(async () => world.votes)
  mocks.getEventStatusLog.mockImplementation(async () => world.log)
  mocks.getJudgeScores.mockImplementation(async () => world.judges)
  mocks.getOtherEventsVoting.mockImplementation(async () => world.otherVoting)
  mocks.wasLockedByRunTheNight.mockImplementation(
    async () => world.lockedByRunTheNight
  )
  mocks.logEventTransition.mockResolvedValue(undefined)
  mocks.deleteFinalizedResults.mockImplementation(async () => {
    world.frozen = []
  })
  mocks.finalizeEventResults.mockImplementation(async () => {
    world.frozen = [
      frozenRow('b1', 'Alpha', 1, '80.00', 3),
      frozenRow('b2', 'Bravo', 2, '46.67', 1),
    ]
    return world.frozen
  })
  // Compare-and-swap, as the SQL does it.
  mocks.transitionEventStatus.mockImplementation(async (_id, from, to) => {
    if (!world.exists || world.status !== from) return null
    world.status = to
    return eventRow()
  })
}

/** Calls to transitionEventStatus as [from, to]. */
function statusWrites(): [string, string][] {
  return mocks.transitionEventStatus.mock.calls.map(([, from, to]) => [
    from,
    to,
  ])
}

describe('night', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    world = readyWorld('closed')
    wireMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('getPathsToRevalidate', () => {
    it('covers the pages whose cached HTML shows the event status', () => {
      expect(getPathsToRevalidate('ev')).toEqual([
        '/',
        '/events',
        '/event/ev',
        '/results/ev',
      ])
    })
  })

  describe('performTransition', () => {
    it('answers 404 for an unknown event and writes nothing', async () => {
      world.exists = false
      const result = await performTransition(
        EVENT_ID,
        { transition: 'close-voting' },
        'admin@example.com'
      )
      expect(result).toMatchObject({
        ok: false,
        httpStatus: 404,
        code: 'not-found',
      })
      expect(mocks.transitionEventStatus).not.toHaveBeenCalled()
    })

    it.each<[EventStatus, TransitionId]>([
      ['voting', 'lock-results'],
      ['closed', 'close-voting'],
      ['locked', 'lock-results'],
      ['finalized', 'release-results'],
      ['upcoming', 'close-voting'],
    ])(
      'refuses as stale (409) when the event is %s and the step is %s',
      async (status, transition) => {
        world.status = status
        const result = await performTransition(
          EVENT_ID,
          { transition, acknowledgedWarnings: [] },
          'admin@example.com'
        )
        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.httpStatus).toBe(409)
        expect(result.code).toBe('stale')
        expect(result.state?.event.status).toBe(status)
        expect(mocks.transitionEventStatus).not.toHaveBeenCalled()
        expect(mocks.finalizeEventResults).not.toHaveBeenCalled()
        expect(mocks.logEventTransition).not.toHaveBeenCalled()
      }
    )

    it('treats an unknown stored status as "upcoming", so only open-voting applies and the CAS still guards it', async () => {
      world.status = 'archived'
      const closing = await performTransition(
        EVENT_ID,
        { transition: 'close-voting' },
        null
      )
      expect(closing).toMatchObject({ ok: false, code: 'stale' })
      expect(mocks.transitionEventStatus).not.toHaveBeenCalled()

      // open-voting passes the in-memory check but the real status is not
      // 'upcoming', so the compare-and-swap refuses it.
      world.votes = []
      const opening = await performTransition(
        EVENT_ID,
        { transition: 'open-voting' },
        null
      )
      expect(opening).toMatchObject({ ok: false, code: 'stale' })
      expect(world.status).toBe('archived')
    })

    it('refuses with 422 and the blockers when something blocks the step', async () => {
      world.votes.push(crowdVote('b2', { status: 'pending' }))
      const result = await performTransition(
        EVENT_ID,
        { transition: 'lock-results', acknowledgedWarnings: [] },
        'admin@example.com'
      )
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.httpStatus).toBe(422)
      expect(result.code).toBe('blocked')
      expect(result.blockers).toEqual([
        '1 held vote still needs a decision. Approve or reject it first.',
      ])
      expect(result.error).toBe(result.blockers?.[0])
      expect(result.state?.event.status).toBe('closed')
      expect(mocks.transitionEventStatus).not.toHaveBeenCalled()
      expect(mocks.finalizeEventResults).not.toHaveBeenCalled()
    })

    it('a blocker cannot be acknowledged away', async () => {
      world.judges = []
      const result = await performTransition(
        EVENT_ID,
        {
          transition: 'lock-results',
          acknowledgedWarnings: ['No judge scores have been entered.'],
        },
        null
      )
      expect(result).toMatchObject({ ok: false, httpStatus: 422 })
      expect(mocks.transitionEventStatus).not.toHaveBeenCalled()
    })

    describe('warnings', () => {
      const warning = 'No crowd votes have been cast yet.'

      beforeEach(() => {
        world = readyWorld('voting')
        world.votes = []
      })

      it('needs confirmation (409) when a warning was not acknowledged', async () => {
        const result = await performTransition(
          EVENT_ID,
          { transition: 'close-voting' },
          null
        )
        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.httpStatus).toBe(409)
        expect(result.code).toBe('needs-confirmation')
        expect(result.warnings).toEqual([warning])
        expect(result.state?.event.status).toBe('voting')
        expect(mocks.transitionEventStatus).not.toHaveBeenCalled()
      })

      it('still needs confirmation when the acknowledged text differs', async () => {
        for (const acknowledgedWarnings of [
          [],
          ['No crowd votes have been cast yet'],
          [warning.toUpperCase()],
          ['Something else entirely.'],
        ]) {
          const result = await performTransition(
            EVENT_ID,
            { transition: 'close-voting', acknowledgedWarnings },
            null
          )
          expect(result).toMatchObject({ code: 'needs-confirmation' })
        }
        expect(mocks.transitionEventStatus).not.toHaveBeenCalled()
      })

      it('goes ahead once that exact warning is acknowledged', async () => {
        const result = await performTransition(
          EVENT_ID,
          { transition: 'close-voting', acknowledgedWarnings: [warning] },
          null
        )
        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.state.event.status).toBe('closed')
        expect(statusWrites()).toEqual([['voting', 'closed']])
      })

      it('needs every warning acknowledged, not just one', async () => {
        world = readyWorld('upcoming')
        world.otherVoting = ['Brisbane 2026']
        const warnings = [
          'This event already has 4 crowd votes. They will be counted with the new ones.',
          'Voting is already open for Brisbane 2026.',
        ]
        const partial = await performTransition(
          EVENT_ID,
          { transition: 'open-voting', acknowledgedWarnings: [warnings[1]] },
          null
        )
        expect(partial).toMatchObject({
          code: 'needs-confirmation',
          warnings,
        })
        expect(mocks.transitionEventStatus).not.toHaveBeenCalled()

        const full = await performTransition(
          EVENT_ID,
          { transition: 'open-voting', acknowledgedWarnings: warnings },
          null
        )
        expect(full.ok).toBe(true)
      })

      it('a confirmed "voting opened by mistake" still goes ahead after more votes arrive', async () => {
        world = readyWorld('voting')
        const shown = getNightState(EVENT_ID).then(
          (st) =>
            st?.transitions.find((t) => t.id === 'cancel-voting')?.warnings ??
            []
        )
        const acknowledgedWarnings = await shown
        world.votes.push(crowdVote('b1'), crowdVote('b2'))
        const result = await performTransition(
          EVENT_ID,
          { transition: 'cancel-voting', acknowledgedWarnings },
          null
        )
        expect(result.ok).toBe(true)
      })

      it('needs confirmation again when a new warning appears (another event opened voting)', async () => {
        world = readyWorld('upcoming')
        const seen = [
          'This event already has 4 crowd votes. They will be counted with the new ones.',
        ]
        world.otherVoting = ['Brisbane 2026']
        const result = await performTransition(
          EVENT_ID,
          { transition: 'open-voting', acknowledgedWarnings: seen },
          null
        )
        expect(result).toMatchObject({
          code: 'needs-confirmation',
          warnings: [...seen, 'Voting is already open for Brisbane 2026.'],
        })
        expect(mocks.transitionEventStatus).not.toHaveBeenCalled()
      })
    })

    it('reports stale when the compare-and-swap loses a race', async () => {
      world = readyWorld('voting')
      mocks.transitionEventStatus.mockImplementationOnce(async () => {
        // Another admin closed voting a moment earlier.
        world.status = 'closed'
        return null
      })
      const result = await performTransition(
        EVENT_ID,
        { transition: 'close-voting' },
        'admin@example.com'
      )
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.httpStatus).toBe(409)
      expect(result.code).toBe('stale')
      expect(result.error).toContain('Voting closed')
      expect(result.state?.event.status).toBe('closed')
      expect(mocks.logEventTransition).not.toHaveBeenCalled()
    })

    it.each<[EventStatus, TransitionId, EventStatus]>([
      ['upcoming', 'open-voting', 'voting'],
      ['voting', 'close-voting', 'closed'],
      ['voting', 'cancel-voting', 'upcoming'],
      ['closed', 'reopen-voting', 'voting'],
      ['closed', 'lock-results', 'locked'],
      ['locked', 'release-results', 'finalized'],
      ['locked', 'unlock-results', 'closed'],
      ['finalized', 'unrelease-results', 'locked'],
    ])(
      'from %s, %s calls the status helper with (eventId, from, to) and logs it',
      async (from, transition, to) => {
        world = readyWorld(from)
        wireMocks()
        const before = await getNightState(EVENT_ID)
        const offered = before?.transitions.find((t) => t.id === transition)
        expect(offered).toBeDefined()

        const result = await performTransition(
          EVENT_ID,
          { transition, acknowledgedWarnings: offered?.warnings },
          'admin@example.com'
        )
        expect(result.ok).toBe(true)
        expect(mocks.transitionEventStatus).toHaveBeenCalledWith(
          EVENT_ID,
          from,
          to
        )
        expect(mocks.logEventTransition).toHaveBeenCalledWith(
          expect.objectContaining({
            eventId: EVENT_ID,
            transition,
            from,
            to,
            actor: 'admin@example.com',
          })
        )
        if (result.ok) expect(result.state.event.status).toBe(to)
      }
    )

    describe('lock-results (finalise)', () => {
      /**
       * Lets the compare-and-swap succeed, then applies `change` as if another
       * admin's write landed in the instant before the lock.
       */
      function raceOnLock(change: () => void) {
        mocks.transitionEventStatus.mockImplementationOnce(
          async (_id, from, to) => {
            change()
            if (world.status !== from) return null
            world.status = to
            return eventRow()
          }
        )
      }

      async function lock() {
        return performTransition(
          EVENT_ID,
          { transition: 'lock-results', acknowledgedWarnings: [] },
          'admin@example.com'
        )
      }

      function expectRevertedWithoutFinalising() {
        expect(statusWrites()).toEqual([
          ['closed', 'locked'],
          ['locked', 'closed'],
        ])
        expect(world.status).toBe('closed')
        expect(mocks.finalizeEventResults).not.toHaveBeenCalled()
        expect(mocks.logEventTransition).not.toHaveBeenCalled()
      }

      describe('re-check after locking', () => {
        it('re-reads the event after the lock, then finalises exactly once', async () => {
          const result = await lock()
          expect(result.ok).toBe(true)
          expect(mocks.finalizeEventResults).toHaveBeenCalledTimes(1)
          const lockAt = mocks.transitionEventStatus.mock.invocationCallOrder[0]
          const readsAfterLock =
            mocks.getCrowdVotesForReview.mock.invocationCallOrder.filter(
              (order) =>
                order > lockAt &&
                order < mocks.finalizeEventResults.mock.invocationCallOrder[0]
            )
          expect(readsAfterLock.length).toBeGreaterThanOrEqual(1)
        })

        it('puts the status back when a vote went back to pending just before the lock', async () => {
          raceOnLock(() => {
            world.votes.push(crowdVote('b2', { status: 'pending' }))
          })
          const result = await lock()
          expect(result.ok).toBe(false)
          if (result.ok) return
          expect(result.httpStatus).toBe(422)
          expect(result.code).toBe('blocked')
          expect(result.blockers).toEqual([
            '1 held vote still needs a decision. Approve or reject it first.',
          ])
          expect(result.error).toBe(result.blockers?.[0])
          expect(result.state?.event.status).toBe('closed')
          expectRevertedWithoutFinalising()
        })

        it('puts the status back when a judge sheet became incomplete', async () => {
          raceOnLock(() => {
            world.judges = world.judges.filter(
              (j) => !(j.name === 'Cat' && j.band_id === 'b2')
            )
          })
          const result = await lock()
          expect(result).toMatchObject({
            ok: false,
            httpStatus: 422,
            code: 'blocked',
            blockers: [
              'Cat has not scored every band. Delete and re-enter that sheet.',
            ],
          })
          expectRevertedWithoutFinalising()
        })

        it('puts the status back when every judge sheet disappeared', async () => {
          raceOnLock(() => {
            world.judges = []
          })
          const result = await lock()
          expect(result).toMatchObject({
            code: 'blocked',
            blockers: ['No judge scores have been entered.'],
          })
          expectRevertedWithoutFinalising()
        })

        it('puts the status back when the event cannot be re-read', async () => {
          raceOnLock(() => {})
          let reads = 0
          mocks.getEventById.mockImplementation(async () => {
            reads++
            // First read before the lock, second the re-check.
            return (reads === 2 ? null : eventRow()) as Event
          })
          const result = await lock()
          expect(result).toMatchObject({
            ok: false,
            httpStatus: 422,
            code: 'blocked',
            blockers: ['The event could not be re-read.'],
          })
          expectRevertedWithoutFinalising()
        })

        it('goes ahead when only a warning appeared (a judge sheet removed, two left)', async () => {
          raceOnLock(() => {
            world.judges = world.judges.filter((j) => j.name !== 'Cat')
          })
          const result = await lock()
          expect(result.ok).toBe(true)
          expect(mocks.finalizeEventResults).toHaveBeenCalledTimes(1)
          expect(statusWrites()).toEqual([['closed', 'locked']])
        })
      })

      it('flips the status to locked BEFORE calculating the frozen results', async () => {
        const result = await performTransition(
          EVENT_ID,
          { transition: 'lock-results', acknowledgedWarnings: [] },
          'admin@example.com'
        )
        expect(result.ok).toBe(true)
        expect(mocks.finalizeEventResults).toHaveBeenCalledWith(
          EVENT_ID,
          '2026.2'
        )
        const lockOrder =
          mocks.transitionEventStatus.mock.invocationCallOrder[0]
        const finalizeOrder =
          mocks.finalizeEventResults.mock.invocationCallOrder[0]
        expect(lockOrder).toBeLessThan(finalizeOrder)
        expect(statusWrites()).toEqual([['closed', 'locked']])
        expect(mocks.deleteFinalizedResults).not.toHaveBeenCalled()
      })

      it('records the winner in the audit log', async () => {
        await performTransition(
          EVENT_ID,
          { transition: 'lock-results', acknowledgedWarnings: [] },
          'admin@example.com'
        )
        expect(mocks.logEventTransition).toHaveBeenCalledWith(
          expect.objectContaining({
            details: expect.objectContaining({ winner: 'Alpha', judges: 3 }),
          })
        )
      })

      it('returns the locked state with the frozen standings', async () => {
        const result = await performTransition(
          EVENT_ID,
          { transition: 'lock-results', acknowledgedWarnings: [] },
          null
        )
        if (!result.ok) throw new Error(result.error)
        expect(result.state.standingsFrozen).toBe(true)
        expect(result.state.standings.map((s) => s.band_name)).toEqual([
          'Alpha',
          'Bravo',
        ])
      })

      it('puts everything back and answers 500 when storing the results throws', async () => {
        mocks.finalizeEventResults.mockImplementationOnce(async () => {
          world.frozen = [frozenRow('b1', 'Alpha', 1, '80.00', 3)]
          throw new Error('connection reset')
        })
        const result = await performTransition(
          EVENT_ID,
          { transition: 'lock-results', acknowledgedWarnings: [] },
          null
        )
        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.httpStatus).toBe(500)
        expect(result.code).toBe('failed')
        expect(mocks.deleteFinalizedResults).toHaveBeenCalledWith(EVENT_ID)
        expect(statusWrites()).toEqual([
          ['closed', 'locked'],
          ['locked', 'closed'],
        ])
        expect(world.status).toBe('closed')
        expect(world.frozen).toEqual([])
        expect(result.state?.event.status).toBe('closed')
        expect(mocks.logEventTransition).not.toHaveBeenCalled()
      })

      it.each([
        ['too few', 1],
        ['none', 0],
        ['too many', 3],
      ])(
        'puts everything back when %s result rows are stored',
        async (_label, count) => {
          mocks.finalizeEventResults.mockImplementationOnce(async () => {
            world.frozen = Array.from({ length: count }, (_, i) =>
              frozenRow(`b${i + 1}`, `Band ${i + 1}`, i + 1, '10.00', 0)
            )
            return world.frozen
          })
          const result = await performTransition(
            EVENT_ID,
            { transition: 'lock-results', acknowledgedWarnings: [] },
            null
          )
          expect(result).toMatchObject({
            ok: false,
            httpStatus: 500,
            code: 'failed',
          })
          expect(mocks.deleteFinalizedResults).toHaveBeenCalledWith(EVENT_ID)
          expect(statusWrites()).toEqual([
            ['closed', 'locked'],
            ['locked', 'closed'],
          ])
          expect(world.status).toBe('closed')
        }
      )

      it('still answers 500 (and does not throw) when the clean-up itself fails', async () => {
        mocks.finalizeEventResults.mockRejectedValueOnce(new Error('boom'))
        mocks.deleteFinalizedResults.mockRejectedValueOnce(
          new Error('also boom')
        )
        const result = await performTransition(
          EVENT_ID,
          { transition: 'lock-results', acknowledgedWarnings: [] },
          null
        )
        expect(result).toMatchObject({ ok: false, code: 'failed' })
        expect(statusWrites()).toEqual([
          ['closed', 'locked'],
          ['locked', 'closed'],
        ])
      })

      it('does not calculate results for a scoring version without a breakdown', async () => {
        world.scoringVersion = '2022.1'
        world.info = { winner: 'Alpha' }
        world.judges = []
        const result = await performTransition(
          EVENT_ID,
          { transition: 'lock-results', acknowledgedWarnings: [] },
          null
        )
        expect(result.ok).toBe(true)
        expect(mocks.finalizeEventResults).not.toHaveBeenCalled()
      })
    })

    describe('results finalised before "Run the night" existed', () => {
      it.each<[EventStatus, TransitionId]>([
        ['locked', 'unlock-results'],
        ['finalized', 'unrelease-results'],
      ])(
        'refuses %s → %s (422) and touches nothing',
        async (status, transition) => {
          world = readyWorld(status)
          world.lockedByRunTheNight = false
          const result = await performTransition(
            EVENT_ID,
            { transition },
            'admin@example.com'
          )
          expect(result.ok).toBe(false)
          if (result.ok) return
          expect(result.httpStatus).toBe(422)
          expect(result.code).toBe('blocked')
          expect(result.blockers?.[0]).toMatch(
            /^These results were finalised before "Run the night" existed/
          )
          expect(mocks.wasLockedByRunTheNight).toHaveBeenCalledWith(EVENT_ID)
          expect(mocks.transitionEventStatus).not.toHaveBeenCalled()
          expect(mocks.deleteFinalizedResults).not.toHaveBeenCalled()
          expect(mocks.logEventTransition).not.toHaveBeenCalled()
          expect(world.frozen).toHaveLength(2)
        }
      )

      it.each<[EventStatus, TransitionId, EventStatus]>([
        ['locked', 'unlock-results', 'closed'],
        ['finalized', 'unrelease-results', 'locked'],
      ])(
        'allows %s → %s when "Run the night" locked them',
        async (status, transition, to) => {
          world = readyWorld(status)
          world.lockedByRunTheNight = true
          const result = await performTransition(EVENT_ID, { transition }, null)
          expect(result.ok).toBe(true)
          expect(statusWrites()).toEqual([[status, to]])
        }
      )

      it('shows the back step as blocked in the state', async () => {
        world = readyWorld('finalized')
        world.lockedByRunTheNight = false
        const state = await getNightState(EVENT_ID)
        const back = state?.transitions.find(
          (t) => t.id === 'unrelease-results'
        )
        expect(back?.blockers).toHaveLength(1)
      })
    })

    it('unlock-results deletes the frozen results', async () => {
      world = readyWorld('locked')
      const result = await performTransition(
        EVENT_ID,
        { transition: 'unlock-results' },
        null
      )
      expect(result.ok).toBe(true)
      expect(mocks.deleteFinalizedResults).toHaveBeenCalledWith(EVENT_ID)
      expect(world.frozen).toEqual([])
      expect(
        mocks.transitionEventStatus.mock.invocationCallOrder[0]
      ).toBeLessThan(mocks.deleteFinalizedResults.mock.invocationCallOrder[0])
    })

    it.each<[EventStatus, TransitionId]>([
      ['locked', 'release-results'],
      ['finalized', 'unrelease-results'],
    ])('%s → %s keeps the frozen results', async (status, transition) => {
      world = readyWorld(status)
      const result = await performTransition(EVENT_ID, { transition }, null)
      expect(result.ok).toBe(true)
      expect(mocks.deleteFinalizedResults).not.toHaveBeenCalled()
      expect(mocks.finalizeEventResults).not.toHaveBeenCalled()
    })

    it('does not fail the transition when writing the audit log fails', async () => {
      world = readyWorld('upcoming')
      world.votes = []
      mocks.logEventTransition.mockRejectedValueOnce(new Error('log down'))
      const result = await performTransition(
        EVENT_ID,
        { transition: 'open-voting' },
        null
      )
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.state.event.status).toBe('voting')
    })

    // The lock's log entry is what later allows "Unlock results" and "Take
    // results down", so for that one step it is not optional.
    it('retries the audit log once when finalising', async () => {
      world = readyWorld('closed')
      mocks.logEventTransition.mockRejectedValueOnce(new Error('log blip'))
      const result = await performTransition(
        EVENT_ID,
        { transition: 'lock-results' },
        null
      )
      expect(result.ok).toBe(true)
      expect(mocks.logEventTransition).toHaveBeenCalledTimes(2)
      expect(mocks.finalizeEventResults).toHaveBeenCalledTimes(1)
    })

    it('undoes the lock when its audit log entry cannot be written', async () => {
      world = readyWorld('closed')
      mocks.logEventTransition.mockRejectedValue(new Error('log down'))
      const result = await performTransition(
        EVENT_ID,
        { transition: 'lock-results' },
        null
      )
      expect(result).toMatchObject({
        ok: false,
        httpStatus: 500,
        code: 'failed',
      })
      expect(mocks.deleteFinalizedResults).toHaveBeenCalledWith(EVENT_ID)
      expect(mocks.transitionEventStatus).toHaveBeenLastCalledWith(
        EVENT_ID,
        'locked',
        'closed'
      )
    })

    it('blocks release when the frozen rows do not cover every band', async () => {
      world = readyWorld('locked')
      world.frozen = [frozenRow('b1', 'Alpha', 1, '80.00', 3)]
      const result = await performTransition(
        EVENT_ID,
        { transition: 'release-results' },
        null
      )
      expect(result).toMatchObject({ ok: false, httpStatus: 422 })
      expect(mocks.transitionEventStatus).not.toHaveBeenCalled()
    })
  })

  describe('getNightState', () => {
    it('returns null for an unknown event', async () => {
      world.exists = false
      expect(await getNightState(EVENT_ID)).toBeNull()
    })

    it('describes the event and its scoring', async () => {
      world.isTest = true
      const state = await getNightState(EVENT_ID)
      expect(state?.event).toEqual({
        id: EVENT_ID,
        name: 'Sydney 2026',
        date: '2026-10-08T08:00:00Z',
        timezone: 'Australia/Sydney',
        location: 'Factory Theatre',
        status: 'closed',
        isTest: true,
      })
      expect(state?.scoring).toEqual({
        version: '2026.2',
        hasDetailedBreakdown: true,
        hasVisuals: true,
        hasScreamOMeter: false,
        crowdVoteMax: 20,
        maxJudgePoints: 80,
      })
    })

    it('treats an unknown stored status as "upcoming"', async () => {
      world.status = 'archived'
      const state = await getNightState(EVENT_ID)
      expect(state?.event.status).toBe('upcoming')
      expect(state?.transitions.map((t) => t.id)).toEqual(['open-voting'])
    })

    it.each<EventStatus>(['upcoming', 'voting', 'closed'])(
      'uses the live standings while %s',
      async (status) => {
        world.status = status
        world.frozen = [
          frozenRow('b2', 'Bravo', 1, '99.00', 1),
          frozenRow('b1', 'Alpha', 2, '1.00', 3),
        ]
        const state = await getNightState(EVENT_ID)
        expect(state?.standingsFrozen).toBe(false)
        expect(state?.standings.map((s) => s.band_name)).toEqual([
          'Alpha',
          'Bravo',
        ])
        expect(state?.standings[0].totalScore).toBe(80)
        expect(state?.standings[1].totalScore).toBeCloseTo(46.6667, 3)
        expect(state?.frozenMatchesLive).toBe(true)
      }
    )

    it.each<EventStatus>(['locked', 'finalized'])(
      'uses the frozen standings once %s, converting numeric strings',
      async (status) => {
        world.status = status
        // Rows out of rank order, as numeric strings.
        world.frozen = [
          frozenRow('b2', 'Bravo', 2, '46.67', 1),
          frozenRow('b1', 'Alpha', 1, '80.00', 3),
        ]
        const state = await getNightState(EVENT_ID)
        expect(state?.standingsFrozen).toBe(true)
        expect(state?.standings.map((s) => [s.rank, s.band_name])).toEqual([
          [1, 'Alpha'],
          [2, 'Bravo'],
        ])
        expect(state?.standings[0]).toMatchObject({
          totalScore: 80,
          songChoice: 15,
          crowdVoteScore: 20,
          judgeScore: 60,
          crowdVoteCount: 3,
          tiedWithPrevious: false,
        })
        expect(state?.frozenMatchesLive).toBe(true)
      }
    )

    it('flags a frozen tie at two decimal places', async () => {
      world.status = 'locked'
      world.frozen = [
        frozenRow('b1', 'Alpha', 1, '80.00', 3),
        frozenRow('b2', 'Bravo', 2, '80.00', 1),
      ]
      const state = await getNightState(EVENT_ID)
      expect(state?.standings[1].tiedWithPrevious).toBe(true)
    })

    it('marks the frozen results stale when a live crowd count changed', async () => {
      world.status = 'locked'
      // One more approved vote for Bravo after locking. Alpha still leads, so
      // Alpha's total is unchanged; Bravo's count (and total) are not.
      world.scores = [
        scoreRow('b1', 'Alpha', 15, 3),
        scoreRow('b2', 'Bravo', 10, 2),
      ]
      const state = await getNightState(EVENT_ID)
      expect(state?.frozenMatchesLive).toBe(false)
      const release = state?.transitions.find((t) => t.id === 'release-results')
      expect(release?.blockers).toEqual([])
      expect(release?.warnings[0]).toContain(
        'Votes or judge scores changed after the results were locked.'
      )
    })

    it('marks the frozen results stale when a live crowd count differs but totals agree', async () => {
      world.status = 'locked'
      world.frozen = [
        frozenRow('b1', 'Alpha', 1, '80.00', 3),
        frozenRow('b2', 'Bravo', 2, '46.67', 5),
      ]
      const state = await getNightState(EVENT_ID)
      expect(state?.frozenMatchesLive).toBe(false)
    })

    describe('frozen totals are compared with a rounding tolerance', () => {
      /** Alpha's live total is exactly `alphaTotal`; nobody has crowd votes. */
      function liveAlpha(alphaTotal: string) {
        world.status = 'locked'
        world.scores = [
          {
            ...scoreRow('b1', 'Alpha', 0, 0),
            avg_song_choice: alphaTotal,
          },
          scoreRow('b2', 'Bravo', 10, 0),
        ]
      }

      function frozenAlpha(alphaTotal: string) {
        world.frozen = [
          frozenRow('b1', 'Alpha', 1, alphaTotal, 0),
          frozenRow('b2', 'Bravo', 2, '40.00', 0),
        ]
      }

      it.each([
        ['70.015', '70.02'],
        ['70.015', '70.01'],
        ['70.004', '70.00'],
      ])('a live %s still matches a frozen %s', async (live, frozenTotal) => {
        liveAlpha(live)
        frozenAlpha(frozenTotal)
        const state = await getNightState(EVENT_ID)
        expect(state?.frozenMatchesLive).toBe(true)
      })

      it.each([
        ['70.03', '70.02'],
        ['70.01', '70.02'],
        ['71', '70.00'],
      ])('a live %s does not match a frozen %s', async (live, frozenTotal) => {
        liveAlpha(live)
        frozenAlpha(frozenTotal)
        const state = await getNightState(EVENT_ID)
        expect(state?.frozenMatchesLive).toBe(false)
      })
    })

    it('marks the frozen results stale when a band has no frozen row', async () => {
      world.status = 'locked'
      world.frozen = [frozenRow('b1', 'Alpha', 1, '80.00', 3)]
      const state = await getNightState(EVENT_ID)
      expect(state?.frozenMatchesLive).toBe(false)
      const release = state?.transitions.find((t) => t.id === 'release-results')
      expect(release?.blockers).toHaveLength(1)
    })

    it('groups judge rows by name, ignoring case and spaces, and counts bands scored', async () => {
      world.judges = [
        judgeRow('Ann', 'b1', 15),
        judgeRow(' ann ', 'b2', 10),
        judgeRow('ANN', 'b2', 12), // re-entered: still one band
        judgeRow('Ben', 'b1', 14),
        judgeRow('Ben', 'other-event-band', 9), // not one of this event's bands
      ]
      const state = await getNightState(EVENT_ID)
      expect(state?.judges.map((j) => [j.name, j.bandsScored])).toEqual([
        ['Ann', 2],
        ['Ben', 1],
      ])
      const ann = state?.judges[0]
      expect(ann?.scores.b1).toEqual({
        song_choice: 15,
        performance: 15,
        crowd_vibe: 15,
        visuals: 15,
        total: 60,
      })
      // Ben has not scored Bravo, so finalising is blocked naming him.
      const lock = state?.transitions.find((t) => t.id === 'lock-results')
      expect(lock?.blockers).toEqual([
        'Ben has not scored every band. Delete and re-enter that sheet.',
      ])
    })

    it('counts a missing score as 0 in the judge total', async () => {
      world.judges = [{ ...judgeRow('Ann', 'b1', 15), visuals: null }]
      const state = await getNightState(EVENT_ID)
      expect(state?.judges[0].scores.b1.total).toBe(45)
    })

    it('lists only pending votes in the queue and only decided votes as reviewed, most recent first', async () => {
      voteSeq = 0
      world.votes = [
        crowdVote('b1', { fingerprintjs_visitor_id: 'same' }),
        crowdVote('b1', {
          status: 'rejected',
          reviewed_at: '2026-10-08T10:00:00Z',
        }),
        crowdVote('b2', {
          status: 'approved',
          reviewed_at: '2026-10-08T10:05:00Z',
        }),
        crowdVote('b2', {
          status: 'pending',
          fingerprintjs_visitor_id: 'same',
        }),
        // A pending vote with a stale stamp is not "decided".
        crowdVote('b2', {
          status: 'pending',
          reviewed_at: '2026-10-08T10:09:00Z',
        }),
      ]
      const state = await getNightState(EVENT_ID)
      expect(state?.reviewQueue.map((i) => i.vote.id)).toEqual([
        'v-004',
        'v-005',
      ])
      expect(state?.reviewed.map((v) => v.id)).toEqual(['v-003', 'v-002'])
      expect(state?.crowd.total).toEqual({
        approved: 2,
        pending: 2,
        rejected: 1,
      })
      expect(state?.crowd.byBand.b2).toEqual({
        approved: 1,
        pending: 2,
        rejected: 0,
      })
    })

    it('reports the last vote and how many arrived in the last minute', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-10-08T09:10:00Z'))
      world.votes = [
        crowdVote('b1', { created_at: '2026-10-08T09:00:00Z' }),
        crowdVote('b1', { created_at: '2026-10-08T09:08:59Z' }),
        // Exactly a minute before: counted.
        crowdVote('b1', { created_at: '2026-10-08T09:09:00Z' }),
        crowdVote('b2', { created_at: '2026-10-08T09:09:30Z' }),
      ]
      const state = await getNightState(EVENT_ID)
      expect(state?.generatedAt).toBe('2026-10-08T09:10:00.000Z')
      expect(state?.crowd.lastVoteAt).toBe('2026-10-08T09:09:30.000Z')
      expect(state?.crowd.votesLastMinute).toBe(2)
    })

    it('offers the transitions for the status with their readiness', async () => {
      world.status = 'closed'
      world.otherVoting = []
      world.judges = [judgeRow('Ann', 'b1', 15), judgeRow('Ann', 'b2', 15)]
      // Level at the top: same judge totals and the same crowd count.
      world.scores = [
        scoreRow('b1', 'Alpha', 15, 2),
        scoreRow('b2', 'Bravo', 15, 2),
      ]
      const state = await getNightState(EVENT_ID)
      expect(state?.transitions.map((t) => [t.id, t.direction, t.to])).toEqual([
        ['lock-results', 'forward', 'locked'],
        ['reopen-voting', 'back', 'voting'],
      ])
      const lock = state?.transitions[0]
      expect(lock?.blockers).toEqual([])
      expect(lock?.warnings).toEqual([
        'Only 1 judge has been entered.',
        '2 bands are level at the top (the same score to two decimal places). Turn on "Show scores" to see which, and check with the judges before you finalise.',
      ])
    })

    it('stamps generatedAt when the reads begin, not when they finish', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-10-08T09:10:00.000Z'))
      const slow =
        <T>(value: T) =>
        () =>
          new Promise<T>((resolve) => setTimeout(() => resolve(value), 3000))
      mocks.getBandsForEvent.mockImplementation(slow(world.bands))
      mocks.getCrowdVotesForReview.mockImplementation(slow(world.votes))
      mocks.getJudgeScores.mockImplementation(slow(world.judges))
      mocks.getBandScores.mockImplementation(slow(world.scores))

      const pending = getNightState(EVENT_ID)
      await vi.advanceTimersByTimeAsync(3000)
      const state = await pending
      expect(new Date().toISOString()).toBe('2026-10-08T09:10:03.000Z')
      expect(state?.generatedAt).toBe('2026-10-08T09:10:00.000Z')
    })

    // A snapshot's status comes from the event row, so the stamp has to
    // predate that read too. Otherwise a poll whose event read was slow could
    // carry a later stamp than another admin's "close voting" and overwrite
    // it on the page with "voting open".
    it('stamps generatedAt before the event row is read', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-10-08T09:10:00.000Z'))
      mocks.getEventById.mockImplementation(
        () =>
          new Promise<Event>((resolve) =>
            setTimeout(() => resolve(eventRow()), 2000)
          )
      )

      const pending = getNightState(EVENT_ID)
      await vi.advanceTimersByTimeAsync(2000)
      const state = await pending
      expect(new Date().toISOString()).toBe('2026-10-08T09:10:02.000Z')
      expect(state?.generatedAt).toBe('2026-10-08T09:10:00.000Z')
    })

    it('normalises the log timestamps', async () => {
      world.log = [
        {
          id: 'l1',
          event_id: EVENT_ID,
          transition: 'open-voting',
          from_status: 'upcoming',
          to_status: 'voting',
          actor: 'admin@example.com',
          details: {},
          created_at: '2026-10-08 19:00:00+11',
        },
      ]
      const state = await getNightState(EVENT_ID)
      expect(state?.log).toEqual([
        {
          transition: 'open-voting',
          from_status: 'upcoming',
          to_status: 'voting',
          actor: 'admin@example.com',
          created_at: '2026-10-08T08:00:00.000Z',
        },
      ])
    })
  })
})
