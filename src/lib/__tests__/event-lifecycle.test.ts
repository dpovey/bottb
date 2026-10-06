import { describe, it, expect } from 'vitest'
import {
  EVENT_STATUSES,
  LIVE_STATUSES,
  PHASES,
  TRANSITIONS,
  areResultsPublic,
  canEditJudgeScores,
  canReviewVotes,
  getAvailableTransitions,
  getStatusLabel,
  getTransitionReadiness,
  hasFrozenResults,
  isCrowdVotingOpen,
  isEventLive,
  isEventStatus,
  isTransitionId,
  type EventStatus,
  type NightFacts,
  type TransitionId,
} from '../event-lifecycle'

/**
 * A night that is ready for every step: five bands, three judges who scored
 * every band, no held votes, frozen results for every band, no tie and no
 * other event voting. Each test changes only the fact it is about.
 */
function readyFacts(overrides: Partial<NightFacts> = {}): NightFacts {
  return {
    bandCount: 5,
    crowdVotes: { approved: 120, pending: 0, rejected: 0 },
    judges: [
      { name: 'Alice', bandsScored: 5 },
      { name: 'Bob', bandsScored: 5 },
      { name: 'Carol', bandsScored: 5 },
    ],
    hasDetailedBreakdown: true,
    winnerRecorded: false,
    frozenResultCount: 5,
    frozenMatchesLive: true,
    tiedForFirst: ['The Leaders'],
    otherEventsVoting: [],
    lockedByRunTheNight: true,
    ...overrides,
  }
}

const ALL_TRANSITIONS = Object.keys(TRANSITIONS) as TransitionId[]

describe('event-lifecycle', () => {
  describe('statuses', () => {
    it('runs upcoming → voting → closed → locked → finalized in that order', () => {
      expect(EVENT_STATUSES).toEqual([
        'upcoming',
        'voting',
        'closed',
        'locked',
        'finalized',
      ])
    })

    it('recognises exactly the five statuses', () => {
      for (const status of EVENT_STATUSES) {
        expect(isEventStatus(status)).toBe(true)
      }
      expect(isEventStatus('active')).toBe(false)
      expect(isEventStatus('FINALIZED')).toBe(false)
      expect(isEventStatus('')).toBe(false)
      expect(isEventStatus(undefined)).toBe(false)
      expect(isEventStatus(3)).toBe(false)
    })

    it('labels known statuses and passes unknown ones through', () => {
      expect(getStatusLabel('locked')).toBe(PHASES.locked.label)
      expect(getStatusLabel('finalized')).toBe('Results released')
      expect(getStatusLabel('something-new')).toBe('something-new')
    })

    it('lists voting, closed and locked as the live statuses', () => {
      expect([...LIVE_STATUSES].sort()).toEqual(
        ['closed', 'locked', 'voting'].sort()
      )
    })
  })

  describe('predicates', () => {
    // One row per status: [crowd voting open, live, judges editable,
    // votes reviewable, frozen results, public results]
    const table: Record<
      EventStatus,
      [boolean, boolean, boolean, boolean, boolean, boolean]
    > = {
      upcoming: [false, false, true, false, false, false],
      voting: [true, true, true, true, false, false],
      closed: [false, true, true, true, false, false],
      locked: [false, true, false, false, true, false],
      finalized: [false, false, false, false, true, true],
    }

    it.each(EVENT_STATUSES)('gives the expected answers for %s', (status) => {
      const [open, live, judges, review, frozen, isPublic] = table[status]
      expect(isCrowdVotingOpen(status)).toBe(open)
      expect(isEventLive(status)).toBe(live)
      expect(canEditJudgeScores(status)).toBe(judges)
      expect(canReviewVotes(status)).toBe(review)
      expect(hasFrozenResults(status)).toBe(frozen)
      expect(areResultsPublic(status)).toBe(isPublic)
    })

    it('agrees with LIVE_STATUSES', () => {
      for (const status of EVENT_STATUSES) {
        expect(isEventLive(status)).toBe(LIVE_STATUSES.includes(status))
      }
    })
  })

  describe('transitions', () => {
    it('recognises every transition id and nothing else', () => {
      for (const id of ALL_TRANSITIONS) expect(isTransitionId(id)).toBe(true)
      expect(isTransitionId('finalize')).toBe(false)
      expect(isTransitionId(undefined)).toBe(false)
    })

    it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
      'rejects the Object.prototype key %j',
      (key) => {
        expect(isTransitionId(key)).toBe(false)
      }
    )

    it('moves exactly one step along the line, forward or back', () => {
      for (const t of Object.values(TRANSITIONS)) {
        const from = EVENT_STATUSES.indexOf(t.from)
        const to = EVENT_STATUSES.indexOf(t.to)
        expect(Math.abs(to - from)).toBe(1)
        expect(t.direction).toBe(to > from ? 'forward' : 'back')
      }
    })

    const expected: Record<EventStatus, TransitionId[]> = {
      upcoming: ['open-voting'],
      voting: ['close-voting', 'cancel-voting'],
      closed: ['lock-results', 'reopen-voting'],
      locked: ['release-results', 'unlock-results'],
      finalized: ['unrelease-results'],
    }

    it.each(EVENT_STATUSES)(
      'offers exactly the expected transitions from %s, forward first',
      (status) => {
        const available = getAvailableTransitions(status)
        expect(available.map((t) => t.id)).toEqual(expected[status])
        for (const t of available) expect(t.from).toBe(status)
      }
    )

    it('has the expected endpoints for each transition', () => {
      const endpoints = Object.fromEntries(
        Object.values(TRANSITIONS).map((t) => [t.id, `${t.from}->${t.to}`])
      )
      expect(endpoints).toEqual({
        'open-voting': 'upcoming->voting',
        'close-voting': 'voting->closed',
        'lock-results': 'closed->locked',
        'release-results': 'locked->finalized',
        'cancel-voting': 'voting->upcoming',
        'reopen-voting': 'closed->voting',
        'unlock-results': 'locked->closed',
        'unrelease-results': 'finalized->locked',
      })
    })
  })

  describe('getTransitionReadiness', () => {
    it.each(ALL_TRANSITIONS)(
      'has no blockers or warnings for %s on a ready night',
      (transition) => {
        // A ready night still has votes, which open/cancel/close warn about;
        // check the clean case with the facts each step cares about.
        const facts =
          transition === 'open-voting' || transition === 'cancel-voting'
            ? readyFacts({
                crowdVotes: { approved: 0, pending: 0, rejected: 0 },
              })
            : readyFacts()
        expect(getTransitionReadiness(transition, facts)).toEqual({
          blockers: [],
          warnings: [],
        })
      }
    )

    describe('open-voting', () => {
      const none = { approved: 0, pending: 0, rejected: 0 }

      it('is blocked with fewer than two bands', () => {
        for (const bandCount of [0, 1]) {
          const r = getTransitionReadiness(
            'open-voting',
            readyFacts({ bandCount, crowdVotes: none })
          )
          expect(r.blockers).toHaveLength(1)
          expect(r.blockers[0]).toContain(
            `This event has ${bandCount} band${bandCount === 1 ? '' : 's'}.`
          )
        }
      })

      it('is not blocked with exactly two bands', () => {
        const r = getTransitionReadiness(
          'open-voting',
          readyFacts({ bandCount: 2, crowdVotes: none })
        )
        expect(r.blockers).toEqual([])
      })

      it('warns (does not block) when crowd votes already exist, counting every status', () => {
        const r = getTransitionReadiness(
          'open-voting',
          readyFacts({ crowdVotes: { approved: 1, pending: 1, rejected: 1 } })
        )
        expect(r.blockers).toEqual([])
        expect(r.warnings).toEqual([
          'This event already has 3 crowd votes. They will be counted with the new ones.',
        ])
      })

      it('uses the singular for one existing vote', () => {
        const r = getTransitionReadiness(
          'open-voting',
          readyFacts({ crowdVotes: { approved: 0, pending: 0, rejected: 1 } })
        )
        expect(r.warnings[0]).toContain('already has 1 crowd vote.')
      })

      it('warns when other events have voting open, naming them', () => {
        const r = getTransitionReadiness(
          'open-voting',
          readyFacts({
            crowdVotes: none,
            otherEventsVoting: ['Brisbane 2026', 'Melbourne 2026'],
          })
        )
        expect(r.blockers).toEqual([])
        expect(r.warnings).toEqual([
          'Voting is already open for Brisbane 2026, Melbourne 2026.',
        ])
      })
    })

    describe('close-voting', () => {
      it('warns when no crowd votes have been cast', () => {
        const r = getTransitionReadiness(
          'close-voting',
          readyFacts({ crowdVotes: { approved: 0, pending: 0, rejected: 0 } })
        )
        expect(r).toEqual({
          blockers: [],
          warnings: ['No crowd votes have been cast yet.'],
        })
      })

      it('does not warn when the only votes are held', () => {
        const r = getTransitionReadiness(
          'close-voting',
          readyFacts({ crowdVotes: { approved: 0, pending: 2, rejected: 0 } })
        )
        expect(r.warnings).toEqual([])
      })
    })

    describe('lock-results (finalise)', () => {
      it('is blocked while one held vote is pending', () => {
        const r = getTransitionReadiness(
          'lock-results',
          readyFacts({ crowdVotes: { approved: 10, pending: 1, rejected: 0 } })
        )
        expect(r.blockers).toEqual([
          '1 held vote still needs a decision. Approve or reject it first.',
        ])
      })

      it('is blocked while several held votes are pending', () => {
        const r = getTransitionReadiness(
          'lock-results',
          readyFacts({ crowdVotes: { approved: 10, pending: 4, rejected: 0 } })
        )
        expect(r.blockers).toEqual([
          '4 held votes still need a decision. Approve or reject them first.',
        ])
      })

      it('is not blocked by rejected votes', () => {
        const r = getTransitionReadiness(
          'lock-results',
          readyFacts({ crowdVotes: { approved: 10, pending: 0, rejected: 9 } })
        )
        expect(r.blockers).toEqual([])
      })

      it('is blocked when no judge has been entered', () => {
        const r = getTransitionReadiness(
          'lock-results',
          readyFacts({ judges: [] })
        )
        expect(r.blockers).toEqual(['No judge scores have been entered.'])
        // "Fewer than three judges" is about judges that exist; zero judges
        // is a blocker, not also a warning.
        expect(r.warnings).toEqual([])
      })

      it('is blocked when one judge has not scored every band, naming them', () => {
        const r = getTransitionReadiness(
          'lock-results',
          readyFacts({
            judges: [
              { name: 'Alice', bandsScored: 5 },
              { name: 'Bob', bandsScored: 4 },
              { name: 'Carol', bandsScored: 5 },
            ],
          })
        )
        expect(r.blockers).toEqual([
          'Bob has not scored every band. Delete and re-enter that sheet.',
        ])
      })

      it('is blocked when several judges have not scored every band', () => {
        const r = getTransitionReadiness(
          'lock-results',
          readyFacts({
            judges: [
              { name: 'Alice', bandsScored: 0 },
              { name: 'Bob', bandsScored: 4 },
              { name: 'Carol', bandsScored: 5 },
            ],
          })
        )
        expect(r.blockers).toEqual([
          'Alice, Bob have not scored every band. Delete and re-enter those sheets.',
        ])
      })

      it('reports every blocker at once', () => {
        const r = getTransitionReadiness(
          'lock-results',
          readyFacts({
            crowdVotes: { approved: 3, pending: 2, rejected: 0 },
            judges: [{ name: 'Alice', bandsScored: 2 }],
          })
        )
        expect(r.blockers).toHaveLength(2)
        expect(r.blockers[0]).toContain('2 held votes')
        expect(r.blockers[1]).toContain('Alice has not scored every band')
      })

      it('warns (does not block) when there are no approved crowd votes', () => {
        const r = getTransitionReadiness(
          'lock-results',
          readyFacts({ crowdVotes: { approved: 0, pending: 0, rejected: 7 } })
        )
        expect(r.blockers).toEqual([])
        expect(r.warnings).toEqual([
          'There are no approved crowd votes, so every band gets 0 for the crowd vote.',
        ])
      })

      it('warns (does not block) with one judge', () => {
        const r = getTransitionReadiness(
          'lock-results',
          readyFacts({ judges: [{ name: 'Alice', bandsScored: 5 }] })
        )
        expect(r.blockers).toEqual([])
        expect(r.warnings).toEqual(['Only 1 judge has been entered.'])
      })

      it('warns (does not block) with two judges', () => {
        const r = getTransitionReadiness(
          'lock-results',
          readyFacts({
            judges: [
              { name: 'Alice', bandsScored: 5 },
              { name: 'Bob', bandsScored: 5 },
            ],
          })
        )
        expect(r.blockers).toEqual([])
        expect(r.warnings).toEqual(['Only 2 judges have been entered.'])
      })

      it('does not warn about judges with three or more', () => {
        const four = [...readyFacts().judges, { name: 'Dan', bandsScored: 5 }]
        expect(
          getTransitionReadiness('lock-results', readyFacts({ judges: four }))
            .warnings
        ).toEqual([])
      })

      it('warns (does not block) on a tie at the top, without naming the bands', () => {
        const r = getTransitionReadiness(
          'lock-results',
          readyFacts({ tiedForFirst: ['Band A', 'Band B'] })
        )
        expect(r.blockers).toEqual([])
        expect(r.warnings).toEqual([
          '2 bands are level at the top (the same score to two decimal places). Turn on "Show scores" to see which, and check with the judges before you finalise.',
        ])
      })

      it('never puts a band name in the tie warning (it is shown with scores hidden)', () => {
        const names = ['Zephyr Rockets', 'Quasar Pointers', 'Null Sisters']
        const r = getTransitionReadiness(
          'lock-results',
          readyFacts({ tiedForFirst: names })
        )
        expect(r.warnings).toHaveLength(1)
        expect(r.warnings[0]).toMatch(/^3 bands are level at the top/)
        for (const name of names) expect(r.warnings[0]).not.toContain(name)
      })

      it('treats a single leader (or no standings) as no tie', () => {
        expect(
          getTransitionReadiness(
            'lock-results',
            readyFacts({ tiedForFirst: [] })
          ).warnings
        ).toEqual([])
      })

      describe('scoring version without a breakdown (2022.1)', () => {
        const legacy = (overrides: Partial<NightFacts> = {}) =>
          readyFacts({
            hasDetailedBreakdown: false,
            judges: [],
            crowdVotes: { approved: 0, pending: 0, rejected: 0 },
            tiedForFirst: [],
            ...overrides,
          })

        it('is blocked when no winner is recorded', () => {
          expect(
            getTransitionReadiness('lock-results', legacy()).blockers
          ).toEqual([
            'This scoring version only records a winner, and none is set on the event.',
          ])
        })

        it('needs no judges or crowd votes once a winner is recorded', () => {
          expect(
            getTransitionReadiness(
              'lock-results',
              legacy({ winnerRecorded: true })
            )
          ).toEqual({ blockers: [], warnings: [] })
        })

        it('is still blocked by held votes', () => {
          const r = getTransitionReadiness(
            'lock-results',
            legacy({
              winnerRecorded: true,
              crowdVotes: { approved: 0, pending: 1, rejected: 0 },
            })
          )
          expect(r.blockers).toHaveLength(1)
          expect(r.blockers[0]).toContain('1 held vote')
        })
      })
    })

    describe('release-results', () => {
      it('is blocked when no results are frozen', () => {
        const r = getTransitionReadiness(
          'release-results',
          readyFacts({ frozenResultCount: 0 })
        )
        expect(r.blockers).toEqual([
          'The frozen results are missing or incomplete. Unlock and finalise again.',
        ])
      })

      it('is blocked when fewer rows are frozen than there are bands', () => {
        const r = getTransitionReadiness(
          'release-results',
          readyFacts({ frozenResultCount: 4 })
        )
        expect(r.blockers).toHaveLength(1)
      })

      it('is blocked when more rows are frozen than there are bands', () => {
        const r = getTransitionReadiness(
          'release-results',
          readyFacts({ frozenResultCount: 6 })
        )
        expect(r.blockers).toHaveLength(1)
      })

      it('warns (does not block) when the frozen results no longer match the live votes', () => {
        const r = getTransitionReadiness(
          'release-results',
          readyFacts({ frozenMatchesLive: false })
        )
        expect(r.blockers).toEqual([])
        expect(r.warnings).toHaveLength(1)
        expect(r.warnings[0]).toContain(
          'Votes or judge scores changed after the results were locked.'
        )
      })

      it('does not also warn about drift when the frozen rows are incomplete', () => {
        const r = getTransitionReadiness(
          'release-results',
          readyFacts({ frozenResultCount: 2, frozenMatchesLive: false })
        )
        expect(r.blockers).toHaveLength(1)
        expect(r.warnings).toEqual([])
      })

      it('needs no frozen rows for a scoring version without a breakdown', () => {
        expect(
          getTransitionReadiness(
            'release-results',
            readyFacts({ hasDetailedBreakdown: false, frozenResultCount: 0 })
          )
        ).toEqual({ blockers: [], warnings: [] })
      })

      it('ignores ties, judges and held votes (they were settled when locking)', () => {
        expect(
          getTransitionReadiness(
            'release-results',
            readyFacts({
              tiedForFirst: ['A', 'B'],
              judges: [],
              crowdVotes: { approved: 0, pending: 3, rejected: 0 },
            })
          )
        ).toEqual({ blockers: [], warnings: [] })
      })
    })

    describe('cancel-voting', () => {
      it('warns that votes already cast are kept', () => {
        const r = getTransitionReadiness(
          'cancel-voting',
          readyFacts({ crowdVotes: { approved: 2, pending: 1, rejected: 0 } })
        )
        expect(r).toEqual({
          blockers: [],
          warnings: [
            'Votes already cast will be kept and counted when voting reopens.',
          ],
        })
      })

      it('reads the same while votes keep arriving, so a confirmation still matches', () => {
        const at = (approved: number) =>
          getTransitionReadiness(
            'cancel-voting',
            readyFacts({ crowdVotes: { approved, pending: 0, rejected: 0 } })
          ).warnings
        expect(at(5)).toEqual(at(6))
        expect(at(5)).toHaveLength(1)
      })
    })

    describe.each<TransitionId>(['unlock-results', 'unrelease-results'])(
      '%s',
      (transition) => {
        it('is blocked for results finalised before "Run the night" existed', () => {
          const r = getTransitionReadiness(
            transition,
            readyFacts({ lockedByRunTheNight: false })
          )
          expect(r.blockers).toEqual([
            'These results were finalised before "Run the night" existed. They cannot be taken down or unlocked here, because that would replace the original scores.',
          ])
          expect(r.warnings).toEqual([])
        })

        it('is allowed for results finalised by "Run the night"', () => {
          expect(
            getTransitionReadiness(
              transition,
              readyFacts({ lockedByRunTheNight: true })
            )
          ).toEqual({ blockers: [], warnings: [] })
        })
      }
    )

    it.each<TransitionId>([
      'open-voting',
      'close-voting',
      'cancel-voting',
      'reopen-voting',
      'lock-results',
      'release-results',
    ])('%s does not care how the results were locked', (transition) => {
      const facts =
        transition === 'open-voting' || transition === 'cancel-voting'
          ? readyFacts({ crowdVotes: { approved: 0, pending: 0, rejected: 0 } })
          : readyFacts()
      expect(
        getTransitionReadiness(transition, {
          ...facts,
          lockedByRunTheNight: false,
        })
      ).toEqual(getTransitionReadiness(transition, facts))
    })

    describe.each<TransitionId>([
      'reopen-voting',
      'unlock-results',
      'unrelease-results',
    ])('%s', (transition) => {
      it('is never blocked and never warns, even on a messy night', () => {
        expect(
          getTransitionReadiness(
            transition,
            readyFacts({
              bandCount: 0,
              judges: [],
              crowdVotes: { approved: 0, pending: 5, rejected: 0 },
              frozenResultCount: 0,
              frozenMatchesLive: false,
              tiedForFirst: ['A', 'B'],
              otherEventsVoting: ['Elsewhere'],
            })
          )
        ).toEqual({ blockers: [], warnings: [] })
      })
    })
  })
})
