/**
 * Event lifecycle — the state machine behind "Run the night".
 *
 * An event moves through five statuses, one step at a time:
 *
 *   upcoming → voting → closed → locked → finalized
 *
 * - `upcoming`   before crowd voting opens
 * - `voting`     crowd voting is open
 * - `closed`     crowd voting is closed; pending votes are reviewed and judge
 *                scores checked
 * - `locked`     results are calculated and frozen, but not public yet (the
 *                MC announces from the admin screen)
 * - `finalized`  results are public
 *
 * `finalized` keeps the meaning it has always had across the site ("results
 * are public"), so every existing `status === 'finalized'` check stays
 * correct. What the admin UI calls "Finalise results" is the `closed → locked`
 * step, and "Release results" is `locked → finalized`.
 *
 * This module is pure (no database, no server-only imports) so the admin UI,
 * the API routes and the tests all share one definition of what is allowed.
 */

export const EVENT_STATUSES = [
  'upcoming',
  'voting',
  'closed',
  'locked',
  'finalized',
] as const

export type EventStatus = (typeof EVENT_STATUSES)[number]

export function isEventStatus(value: unknown): value is EventStatus {
  return (
    typeof value === 'string' &&
    (EVENT_STATUSES as readonly string[]).includes(value)
  )
}

// ---------------------------------------------------------------------------
// What each status allows
// ---------------------------------------------------------------------------

/** The public can submit crowd votes. */
export function isCrowdVotingOpen(status: EventStatus): boolean {
  return status === 'voting'
}

/**
 * The night is in progress: voting is open, or it has closed and the results
 * are not out yet. A live event is shown as "happening now", never as a past
 * event, and never with a winner.
 */
export function isEventLive(status: EventStatus): boolean {
  return status === 'voting' || status === 'closed' || status === 'locked'
}

/** Admins can enter or delete judge scores. */
export function canEditJudgeScores(status: EventStatus): boolean {
  return status === 'upcoming' || status === 'voting' || status === 'closed'
}

/** Admins can approve or reject crowd votes. */
export function canReviewVotes(status: EventStatus): boolean {
  return status === 'voting' || status === 'closed'
}

/** Results are read from the frozen `finalized_results` rows. */
export function hasFrozenResults(status: EventStatus): boolean {
  return status === 'locked' || status === 'finalized'
}

/** Anyone can see the results. */
export function areResultsPublic(status: EventStatus): boolean {
  return status === 'finalized'
}

/** SQL list of the live statuses, for `status IN (...)` / `NOT IN (...)`. */
export const LIVE_STATUSES: readonly EventStatus[] = [
  'voting',
  'closed',
  'locked',
]

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export interface PhaseInfo {
  status: EventStatus
  /** Short name for the stepper and badges. */
  label: string
  /** What is true while the event is in this status. */
  summary: string
}

export const PHASES: Record<EventStatus, PhaseInfo> = {
  upcoming: {
    status: 'upcoming',
    label: 'Before voting',
    summary:
      'Crowd voting has not opened. The voting page tells people to hang on.',
  },
  voting: {
    status: 'voting',
    label: 'Voting open',
    summary: 'The crowd can vote now.',
  },
  closed: {
    status: 'closed',
    label: 'Voting closed',
    summary:
      'No more crowd votes. Review the held votes and check the judge scores.',
  },
  locked: {
    status: 'locked',
    label: 'Results locked',
    summary:
      'Results are final and frozen. Only admins can see them until you release.',
  },
  finalized: {
    status: 'finalized',
    label: 'Results released',
    summary: 'Results are public on the site.',
  },
}

/** Label for a status badge anywhere in the admin or on the big screen. */
export function getStatusLabel(status: string): string {
  return isEventStatus(status) ? PHASES[status].label : status
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export type TransitionId =
  | 'open-voting'
  | 'close-voting'
  | 'lock-results'
  | 'release-results'
  | 'cancel-voting'
  | 'reopen-voting'
  | 'unlock-results'
  | 'unrelease-results'

export interface TransitionDef {
  id: TransitionId
  from: EventStatus
  to: EventStatus
  /** `back` transitions undo a step; they are offered as a secondary action. */
  direction: 'forward' | 'back'
  /** Button label. */
  label: string
  /** What happens, shown in the confirmation dialog. */
  effect: string
}

export const TRANSITIONS: Record<TransitionId, TransitionDef> = {
  'open-voting': {
    id: 'open-voting',
    from: 'upcoming',
    to: 'voting',
    direction: 'forward',
    label: 'Open crowd voting',
    effect:
      'The voting page starts accepting votes straight away and the event shows as live on the site.',
  },
  'close-voting': {
    id: 'close-voting',
    from: 'voting',
    to: 'closed',
    direction: 'forward',
    label: 'Close crowd voting',
    effect:
      'The voting page stops accepting votes straight away. Votes already cast are kept.',
  },
  'lock-results': {
    id: 'lock-results',
    from: 'closed',
    to: 'locked',
    direction: 'forward',
    label: 'Finalise results',
    effect:
      'Scores are calculated from the approved crowd votes and the judge scores, then frozen. Nothing is public yet.',
  },
  'release-results': {
    id: 'release-results',
    from: 'locked',
    to: 'finalized',
    direction: 'forward',
    label: 'Release results',
    effect:
      'The results page, the winner and the full score breakdown become public.',
  },
  'cancel-voting': {
    id: 'cancel-voting',
    from: 'voting',
    to: 'upcoming',
    direction: 'back',
    label: 'Voting opened by mistake',
    effect:
      'Voting closes and the event goes back to "before voting". Votes already cast are kept.',
  },
  'reopen-voting': {
    id: 'reopen-voting',
    from: 'closed',
    to: 'voting',
    direction: 'back',
    label: 'Reopen crowd voting',
    effect: 'The voting page starts accepting votes again.',
  },
  'unlock-results': {
    id: 'unlock-results',
    from: 'locked',
    to: 'closed',
    direction: 'back',
    label: 'Unlock results',
    effect:
      'The frozen results are discarded so votes and judge scores can be corrected. You will need to finalise again.',
  },
  'unrelease-results': {
    id: 'unrelease-results',
    from: 'finalized',
    to: 'locked',
    direction: 'back',
    label: 'Take results down',
    effect:
      'The results stop being public. The frozen results are kept, so you can release them again unchanged.',
  },
}

export function isTransitionId(value: unknown): value is TransitionId {
  return typeof value === 'string' && Object.hasOwn(TRANSITIONS, value)
}

/** Transitions that can be taken from `status`, forward first. */
export function getAvailableTransitions(status: EventStatus): TransitionDef[] {
  return Object.values(TRANSITIONS)
    .filter((t) => t.from === status)
    .sort((a, b) =>
      a.direction === b.direction ? 0 : a.direction === 'forward' ? -1 : 1
    )
}

// ---------------------------------------------------------------------------
// Readiness — what must (or should) be true before a transition
// ---------------------------------------------------------------------------

/** Facts about the event that the readiness rules are evaluated against. */
export interface NightFacts {
  bandCount: number
  crowdVotes: { approved: number; pending: number; rejected: number }
  /** One entry per judge who has submitted scores. */
  judges: { name: string; bandsScored: number }[]
  /** The scoring version calculates a score breakdown (everything but 2022.1). */
  hasDetailedBreakdown: boolean
  /** For versions without a breakdown: a winner is recorded on the event. */
  winnerRecorded: boolean
  /** How many bands have a frozen result row. */
  frozenResultCount: number
  /** The frozen results still add up from the votes in the database. */
  frozenMatchesLive: boolean
  /** Bands level at the top of the current standings (one name = no tie). */
  tiedForFirst: string[]
  /** Other (non-test) events that currently have crowd voting open. */
  otherEventsVoting: string[]
  /** The current frozen results were made by the "Finalise results" step. */
  lockedByRunTheNight: boolean
}

export interface Readiness {
  /** Reasons the transition cannot happen. It is refused while any remain. */
  blockers: string[]
  /** Things worth a second look. The transition needs an explicit "go ahead". */
  warnings: string[]
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/**
 * Evaluate a transition against the current facts.
 *
 * Blockers are reserved for states where going ahead would produce a wrong or
 * meaningless result (and where one tap in the admin fixes it). Everything
 * else is a warning, because on the night the operator knows things this code
 * does not.
 */
export function getTransitionReadiness(
  transition: TransitionId,
  facts: NightFacts
): Readiness {
  const blockers: string[] = []
  const warnings: string[] = []
  const totalCrowd =
    facts.crowdVotes.approved +
    facts.crowdVotes.pending +
    facts.crowdVotes.rejected

  switch (transition) {
    case 'open-voting': {
      if (facts.bandCount < 2) {
        blockers.push(
          `This event has ${plural(facts.bandCount, 'band')}. Add the bands before opening voting.`
        )
      }
      if (totalCrowd > 0) {
        warnings.push(
          `This event already has ${plural(totalCrowd, 'crowd vote')}. They will be counted with the new ones.`
        )
      }
      if (facts.otherEventsVoting.length > 0) {
        warnings.push(
          `Voting is already open for ${facts.otherEventsVoting.join(', ')}.`
        )
      }
      break
    }

    case 'close-voting': {
      if (totalCrowd === 0) {
        warnings.push('No crowd votes have been cast yet.')
      }
      break
    }

    case 'lock-results': {
      if (facts.crowdVotes.pending > 0) {
        blockers.push(
          `${plural(facts.crowdVotes.pending, 'held vote')} still ${facts.crowdVotes.pending === 1 ? 'needs' : 'need'} a decision. Approve or reject ${facts.crowdVotes.pending === 1 ? 'it' : 'them'} first.`
        )
      }
      if (!facts.hasDetailedBreakdown) {
        if (!facts.winnerRecorded) {
          blockers.push(
            'This scoring version only records a winner, and none is set on the event.'
          )
        }
        break
      }
      if (facts.judges.length === 0) {
        blockers.push('No judge scores have been entered.')
      }
      const incomplete = facts.judges.filter(
        (j) => j.bandsScored < facts.bandCount
      )
      if (incomplete.length > 0) {
        blockers.push(
          `${incomplete.map((j) => j.name).join(', ')} ${incomplete.length === 1 ? 'has' : 'have'} not scored every band. Delete and re-enter ${incomplete.length === 1 ? 'that sheet' : 'those sheets'}.`
        )
      }
      if (facts.crowdVotes.approved === 0) {
        warnings.push(
          'There are no approved crowd votes, so every band gets 0 for the crowd vote.'
        )
      }
      if (facts.judges.length > 0 && facts.judges.length < 3) {
        warnings.push(
          `Only ${plural(facts.judges.length, 'judge')} ${facts.judges.length === 1 ? 'has' : 'have'} been entered.`
        )
      }
      if (facts.tiedForFirst.length > 1) {
        warnings.push(
          `${facts.tiedForFirst.length} bands are level at the top (the same score to two decimal places). Turn on "Show scores" to see which, and check with the judges before you finalise.`
        )
      }
      break
    }

    case 'release-results': {
      if (!facts.hasDetailedBreakdown) break
      if (facts.frozenResultCount !== facts.bandCount) {
        blockers.push(
          'The frozen results are missing or incomplete. Unlock and finalise again.'
        )
      } else if (!facts.frozenMatchesLive) {
        warnings.push(
          'Votes or judge scores changed after the results were locked. The locked results will be released as they are; unlock and finalise again if the change should count.'
        )
      }
      break
    }

    case 'cancel-voting': {
      // No vote count here: the warning has to read the same when it is
      // confirmed as when it was shown, and votes are still arriving.
      if (totalCrowd > 0) {
        warnings.push(
          'Votes already cast will be kept and counted when voting reopens.'
        )
      }
      break
    }

    case 'unlock-results':
    case 'unrelease-results': {
      // Unlocking discards the frozen scores and finalising recalculates them
      // under today's rules. For an event finalised before "Run the night"
      // existed that would silently rewrite history, so it is not offered.
      if (!facts.lockedByRunTheNight) {
        blockers.push(
          'These results were finalised before "Run the night" existed. They cannot be taken down or unlocked here, because that would replace the original scores.'
        )
      }
      break
    }

    case 'reopen-voting':
      break
  }

  return { blockers, warnings }
}
