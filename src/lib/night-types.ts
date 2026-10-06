/**
 * The shape of the "Run the night" admin state, shared by the API route that
 * builds it and the page that renders it. Types only — safe to import anywhere.
 */

import type { EventStatus, TransitionId } from './event-lifecycle'
import type { CrowdVoteCounts, ReviewItem, ReviewVote } from './vote-review'

export interface NightBand {
  id: string
  name: string
  order: number
}

export interface NightJudge {
  name: string
  submittedAt: string
  /** How many of the event's bands this judge has scored. */
  bandsScored: number
  /** Keyed by band id. */
  scores: Record<
    string,
    {
      song_choice: number
      performance: number
      crowd_vibe: number
      visuals: number
      total: number
    }
  >
}

/** One band's row on the standings table, live or frozen. */
export interface NightStanding {
  band_id: string
  band_name: string
  rank: number
  tiedWithPrevious: boolean
  songChoice: number
  performance: number
  crowdVibe: number
  visuals: number
  screamOMeter: number
  crowdVoteCount: number
  crowdVoteScore: number
  judgeScore: number
  totalScore: number
}

export interface NightTransition {
  id: TransitionId
  to: EventStatus
  direction: 'forward' | 'back'
  label: string
  effect: string
  blockers: string[]
  warnings: string[]
}

export interface NightLogEntry {
  transition: string
  from_status: string
  to_status: string
  actor: string | null
  created_at: string
}

export interface NightState {
  event: {
    id: string
    name: string
    date: string
    timezone: string
    location: string
    status: EventStatus
    isTest: boolean
  }
  /** Server clock when this state was built (ISO). */
  generatedAt: string
  scoring: {
    version: string
    hasDetailedBreakdown: boolean
    hasVisuals: boolean
    hasScreamOMeter: boolean
    crowdVoteMax: number
    maxJudgePoints: number
  }
  bands: NightBand[]
  crowd: {
    total: CrowdVoteCounts
    byBand: Record<string, CrowdVoteCounts>
    lastVoteAt: string | null
    /** Votes cast in the 60 seconds before `generatedAt`. */
    votesLastMinute: number
  }
  /** Held votes waiting for a decision, oldest first. */
  reviewQueue: ReviewItem[]
  /** Votes already approved or rejected by an admin, most recent first. */
  reviewed: ReviewVote[]
  judges: NightJudge[]
  /** Frozen results once locked; otherwise calculated from the live votes. */
  standings: NightStanding[]
  standingsFrozen: boolean
  /**
   * Only meaningful when `standingsFrozen`: the live votes still add up to the
   * frozen results. False means something changed after results were locked.
   */
  frozenMatchesLive: boolean
  transitions: NightTransition[]
  log: NightLogEntry[]
}

/** Body of `POST /api/events/[eventId]/night/transition`. */
export interface TransitionRequest {
  transition: TransitionId
  /** Warnings the admin was shown and accepted, verbatim. */
  acknowledgedWarnings?: string[]
}
