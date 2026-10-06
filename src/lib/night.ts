/**
 * "Run the night" — builds the admin's view of an event in progress and
 * carries out lifecycle transitions.
 *
 * Server-only (talks to the database). The rules themselves live in the pure
 * modules `event-lifecycle.ts` and `vote-review.ts`.
 */

import { competingBands } from './competing-bands'
import {
  deleteFinalizedResults,
  finalizeEventResults,
  getBandScores,
  getBandsForEvent,
  getEventById,
  getFinalizedResults,
  calculateStandings,
  getTiedForFirst,
  type BandScoreRow,
  type BandStanding,
} from './db'
import type { Event, FinalizedResult } from './db-types'
import {
  getCrowdVotesForReview,
  getEventStatusLog,
  getJudgeScores,
  getOtherEventsVoting,
  wasLockedByRunTheNight,
  logEventTransition,
  transitionEventStatus,
  type JudgeScoreRow,
} from './db/night'
import {
  TRANSITIONS,
  getAvailableTransitions,
  getTransitionReadiness,
  hasFrozenResults,
  isEventStatus,
  PHASES,
  type EventStatus,
  type NightFacts,
  type TransitionId,
} from './event-lifecycle'
import type {
  NightJudge,
  NightStanding,
  NightState,
  TransitionRequest,
} from './night-types'
import {
  getCategoryById,
  getMaxJudgePoints,
  hasDetailedBreakdown,
  parseScoringVersion,
} from './scoring'
import { buildReviewQueue, countCrowdVotes } from './vote-review'

function toNightStanding(s: BandStanding): NightStanding {
  return {
    band_id: s.band_id,
    band_name: s.band_name,
    rank: s.rank,
    tiedWithPrevious: s.tiedWithPrevious,
    songChoice: s.songChoice,
    performance: s.performance,
    crowdVibe: s.crowdVibe,
    visuals: s.visuals,
    screamOMeter: s.screamOMeterScore,
    crowdVoteCount: s.crowdVoteCount,
    crowdVoteScore: s.crowdVoteScore,
    judgeScore: s.judgeScore,
    totalScore: s.totalScore,
  }
}

/** Frozen rows come back from Postgres as numeric strings; normalise them. */
function frozenToNightStandings(rows: FinalizedResult[]): NightStanding[] {
  const sorted = [...rows].sort((a, b) => a.final_rank - b.final_rank)
  return sorted.map((row, i) => {
    const totalScore = Number(row.total_score || 0)
    const previous = i > 0 ? Number(sorted[i - 1].total_score || 0) : null
    return {
      band_id: row.band_id,
      band_name: row.band_name,
      rank: row.final_rank,
      tiedWithPrevious:
        previous !== null &&
        Math.round(previous * 100) === Math.round(totalScore * 100),
      songChoice: Number(row.avg_song_choice || 0),
      performance: Number(row.avg_performance || 0),
      crowdVibe: Number(row.avg_crowd_vibe || 0),
      visuals: Number(row.avg_visuals || 0),
      screamOMeter: Number(row.crowd_noise_score || 0),
      crowdVoteCount: Number(row.crowd_vote_count || 0),
      crowdVoteScore: Number(row.crowd_score || 0),
      judgeScore: Number(row.judge_score || 0),
      totalScore,
    }
  })
}

/** The frozen results still describe the votes in the database. */
function frozenMatchesLive(
  frozen: NightStanding[],
  live: NightStanding[]
): boolean {
  if (frozen.length !== live.length) return false
  const liveByBand = new Map(live.map((s) => [s.band_id, s]))
  return frozen.every((f) => {
    const l = liveByBand.get(f.band_id)
    // The frozen total was rounded to two places by Postgres and the live one
    // is a float, so allow a rounding step rather than comparing digits.
    return (
      !!l &&
      l.crowdVoteCount === f.crowdVoteCount &&
      Math.abs(l.totalScore - f.totalScore) < 0.006
    )
  })
}

function groupJudges(
  rows: JudgeScoreRow[],
  bandIds: Set<string>
): NightJudge[] {
  const judges = new Map<string, NightJudge>()
  for (const row of rows) {
    const key = row.name.trim().toLowerCase()
    let judge = judges.get(key)
    if (!judge) {
      judge = {
        name: row.name.trim(),
        submittedAt: row.created_at,
        bandsScored: 0,
        scores: {},
      }
      judges.set(key, judge)
    }
    const song_choice = Number(row.song_choice || 0)
    const performance = Number(row.performance || 0)
    const crowd_vibe = Number(row.crowd_vibe || 0)
    const visuals = Number(row.visuals || 0)
    if (bandIds.has(row.band_id) && !judge.scores[row.band_id]) {
      judge.bandsScored++
    }
    judge.scores[row.band_id] = {
      song_choice,
      performance,
      crowd_vibe,
      visuals,
      total: song_choice + performance + crowd_vibe + visuals,
    }
  }
  return [...judges.values()]
}

interface NightSnapshot {
  event: Event
  state: NightState
  facts: NightFacts
  scoringVersion: string
  detailed: boolean
}

async function loadNight(eventId: string): Promise<NightSnapshot | null> {
  // Stamped before anything is read: the page keeps whichever snapshot is
  // newest, and a snapshot is only as new as the moment its reads began.
  const generatedAt = new Date()

  const event = await getEventById(eventId)
  if (!event) return null
  // A status this code does not know (a newer deploy wrote it) is treated as
  // the safest one: nothing open, nothing public.
  const status: EventStatus = isEventStatus(event.status)
    ? event.status
    : 'upcoming'

  const scoringVersion = parseScoringVersion(
    event.info as { scoring_version?: string } | null
  )
  const detailed = hasDetailedBreakdown(scoringVersion)

  const [
    allBands,
    allCrowdVotes,
    judgeRows,
    frozenRows,
    scores,
    log,
    otherVoting,
    lockedByRunTheNight,
  ] = await Promise.all([
    getBandsForEvent(eventId),
    getCrowdVotesForReview(eventId),
    getJudgeScores(eventId),
    getFinalizedResults(eventId),
    getBandScores(eventId) as Promise<BandScoreRow[]>,
    getEventStatusLog(eventId),
    getOtherEventsVoting(eventId),
    wasLockedByRunTheNight(eventId),
  ])

  // Special guests (non-competing bands) are not voted for, judged or
  // ranked, so the night is run over the competing bands only: they set the
  // band count every judge sheet and the frozen results must match, and a
  // stray vote for a guest is neither counted nor put up for review.
  const bands = competingBands(allBands)
  const bandIds = new Set(bands.map((b) => b.id))
  const crowdVotes = allCrowdVotes.filter((v) => bandIds.has(v.band_id))
  const counts = countCrowdVotes(crowdVotes)
  const judges = groupJudges(judgeRows, bandIds)
  const liveStandings = calculateStandings(scores, scoringVersion)
  const live = liveStandings.map(toNightStanding)
  const frozen = hasFrozenResults(status)
  const frozenStandings = frozenToNightStandings(frozenRows)
  const standings = frozen ? frozenStandings : live

  const eventInfo = event.info as
    | { winner?: string; winner_band_id?: string }
    | null
    | undefined
  const matchesLive = frozen ? frozenMatchesLive(frozenStandings, live) : true
  const facts: NightFacts = {
    bandCount: bands.length,
    crowdVotes: counts.total,
    judges: judges.map((j) => ({ name: j.name, bandsScored: j.bandsScored })),
    hasDetailedBreakdown: detailed,
    winnerRecorded: !!(eventInfo?.winner_band_id || eventInfo?.winner),
    frozenResultCount: frozenRows.length,
    frozenMatchesLive: matchesLive,
    tiedForFirst: detailed ? getTiedForFirst(liveStandings) : [],
    otherEventsVoting: otherVoting,
    lockedByRunTheNight,
  }

  const minuteAgo = generatedAt.getTime() - 60_000
  const lastVote = crowdVotes[crowdVotes.length - 1]

  const state: NightState = {
    event: {
      id: event.id,
      name: event.name,
      date: event.date,
      timezone: event.timezone,
      location: event.location,
      status,
      isTest: !!event.is_test,
    },
    generatedAt: generatedAt.toISOString(),
    scoring: {
      version: scoringVersion,
      hasDetailedBreakdown: detailed,
      hasVisuals: getCategoryById(scoringVersion, 'visuals') !== undefined,
      hasScreamOMeter:
        getCategoryById(scoringVersion, 'scream_o_meter') !== undefined,
      crowdVoteMax:
        getCategoryById(scoringVersion, 'crowd_vote')?.maxPoints ?? 0,
      maxJudgePoints: getMaxJudgePoints(scoringVersion),
    },
    bands: bands.map((b) => ({ id: b.id, name: b.name, order: b.order })),
    crowd: {
      total: counts.total,
      byBand: counts.byBand,
      lastVoteAt: lastVote ? new Date(lastVote.created_at).toISOString() : null,
      votesLastMinute: crowdVotes.filter(
        (v) => new Date(v.created_at).getTime() >= minuteAgo
      ).length,
    },
    reviewQueue: buildReviewQueue(crowdVotes),
    reviewed: crowdVotes
      .filter((v) => v.reviewed_at && v.status !== 'pending')
      .sort(
        (a, b) =>
          new Date(b.reviewed_at as string).getTime() -
          new Date(a.reviewed_at as string).getTime()
      ),
    judges,
    standings,
    standingsFrozen: frozen,
    frozenMatchesLive: matchesLive,
    transitions: getAvailableTransitions(status).map((t) => ({
      id: t.id,
      to: t.to,
      direction: t.direction,
      label: t.label,
      effect: t.effect,
      ...getTransitionReadiness(t.id, facts),
    })),
    log: log.map((entry) => ({
      transition: entry.transition,
      from_status: entry.from_status,
      to_status: entry.to_status,
      actor: entry.actor,
      created_at: new Date(entry.created_at).toISOString(),
    })),
  }

  return { event, state, facts, scoringVersion, detailed }
}

/** Everything the "Run the night" page shows, or `null` if there is no event. */
export async function getNightState(
  eventId: string
): Promise<NightState | null> {
  const snapshot = await loadNight(eventId)
  return snapshot?.state ?? null
}

export type TransitionResult =
  | { ok: true; state: NightState }
  | {
      ok: false
      /** HTTP status the API route should answer with. */
      httpStatus: 404 | 409 | 422 | 500
      error: string
      /** `stale`: the event had already moved on. */
      code: 'not-found' | 'stale' | 'blocked' | 'needs-confirmation' | 'failed'
      blockers?: string[]
      warnings?: string[]
      state?: NightState
    }

/**
 * Carry out one lifecycle transition.
 *
 * Refuses when the event is not in the transition's starting status (someone
 * else already moved it), when a blocker applies, or when there is a warning
 * the admin has not been shown and accepted. The status change itself is a
 * compare-and-swap, so two admins pressing the same button cannot both win.
 */
export async function performTransition(
  eventId: string,
  request: TransitionRequest,
  actor: string | null
): Promise<TransitionResult> {
  const def = TRANSITIONS[request.transition]
  const before = await loadNight(eventId)
  if (!before) {
    return {
      ok: false,
      httpStatus: 404,
      code: 'not-found',
      error: 'Event not found',
    }
  }

  const stale = (state: NightState | undefined): TransitionResult => ({
    ok: false,
    httpStatus: 409,
    code: 'stale',
    error: `This event is now "${PHASES[state?.event.status ?? before.state.event.status].label}", so "${def.label}" no longer applies. The page has been refreshed.`,
    state,
  })

  if (before.state.event.status !== def.from) {
    return stale(before.state)
  }

  const readiness = getTransitionReadiness(def.id, before.facts)
  if (readiness.blockers.length > 0) {
    return {
      ok: false,
      httpStatus: 422,
      code: 'blocked',
      error: readiness.blockers[0],
      blockers: readiness.blockers,
      state: before.state,
    }
  }
  const acknowledged = new Set(request.acknowledgedWarnings ?? [])
  if (readiness.warnings.some((w) => !acknowledged.has(w))) {
    return {
      ok: false,
      httpStatus: 409,
      code: 'needs-confirmation',
      error:
        'Something changed since you last looked. Check and confirm again.',
      warnings: readiness.warnings,
      state: before.state,
    }
  }

  const moved = await transitionEventStatus(eventId, def.from, def.to)
  if (!moved) {
    return stale(await getNightState(eventId).then((s) => s ?? undefined))
  }

  const details: Record<string, unknown> = {
    crowdVotes: before.facts.crowdVotes,
    judges: before.facts.judges.length,
  }

  if (def.id === 'lock-results') {
    // The status is now `locked`, so votes and judge sheets can no longer
    // change. Check the rules again on what is actually in the database: a
    // decision undone or a sheet deleted in the instant before the lock would
    // otherwise be frozen in.
    const locked = await loadNight(eventId)
    const recheck = locked
      ? getTransitionReadiness(def.id, locked.facts)
      : { blockers: ['The event could not be re-read.'], warnings: [] }
    if (recheck.blockers.length > 0) {
      // If this revert fails the event stays `locked` with no frozen results:
      // release is blocked and "Unlock results" puts it right.
      await transitionEventStatus(eventId, def.to, def.from).catch((e) =>
        console.error('Failed to revert status after blocked lock:', e)
      )
      return {
        ok: false,
        httpStatus: 422,
        code: 'blocked',
        error: recheck.blockers[0],
        blockers: recheck.blockers,
        state: (await getNightState(eventId)) ?? undefined,
      }
    }
  }

  if (def.id === 'lock-results' && before.detailed) {
    // Nothing can change the votes while the results are calculated and stored.
    try {
      const results = await finalizeEventResults(eventId, before.scoringVersion)
      if (results.length !== before.facts.bandCount) {
        throw new Error(
          `Stored ${results.length} results for ${before.facts.bandCount} bands`
        )
      }
      details.winner = results[0]?.band_name
    } catch (error) {
      console.error('Failed to freeze results:', error)
      // Put everything back so the admin can simply try again.
      await deleteFinalizedResults(eventId).catch((e) =>
        console.error('Failed to clear partial results:', e)
      )
      await transitionEventStatus(eventId, def.to, def.from).catch((e) =>
        console.error('Failed to revert status after failed lock:', e)
      )
      return {
        ok: false,
        httpStatus: 500,
        code: 'failed',
        error:
          'The results could not be saved, so nothing was finalised. Try again.',
        state: (await getNightState(eventId)) ?? undefined,
      }
    }
  }

  if (def.id === 'unlock-results') {
    await deleteFinalizedResults(eventId)
  }

  const writeLog = () =>
    logEventTransition({
      eventId,
      transition: def.id,
      from: def.from,
      to: def.to,
      actor,
      details,
    })

  if (def.id === 'lock-results') {
    // This entry is what later says "these results were made here", which is
    // what allows them to be unlocked or taken down. So for this one step the
    // log is part of the work: without it, undo everything and say so.
    try {
      await writeLog().catch(() => writeLog())
    } catch (error) {
      console.error('Failed to record the lock:', error)
      await deleteFinalizedResults(eventId).catch((e) =>
        console.error('Failed to clear results after unrecorded lock:', e)
      )
      await transitionEventStatus(eventId, def.to, def.from).catch((e) =>
        console.error('Failed to revert status after unrecorded lock:', e)
      )
      return {
        ok: false,
        httpStatus: 500,
        code: 'failed',
        error:
          'The results could not be saved, so nothing was finalised. Try again.',
        state: (await getNightState(eventId)) ?? undefined,
      }
    }
  } else {
    // For every other step the audit log must never be the reason a
    // transition "fails" after the status has already changed.
    await writeLog().catch((e) => console.error('Failed to log transition:', e))
  }

  const state = await getNightState(eventId)
  if (!state) {
    return {
      ok: false,
      httpStatus: 404,
      code: 'not-found',
      error: 'Event not found',
    }
  }
  return { ok: true, state }
}

/** Paths whose cached HTML depends on an event's status. */
export function getPathsToRevalidate(eventId: string): string[] {
  return ['/', '/events', `/event/${eventId}`, `/results/${eventId}`]
}

export type { TransitionId }
