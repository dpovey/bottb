import { sql } from '../sql'
import type { FinalizedResult } from '../db-types'
import { getBandScores } from './events'
import { getCategoryById, parseScoringVersion } from '../scoring'

// ============================================================
// Finalized Results Functions
// ============================================================

export interface BandScoreRow {
  id: string
  name: string
  order: number
  avg_song_choice: string | null
  avg_performance: string | null
  avg_crowd_vibe: string | null
  avg_visuals: string | null
  avg_crowd_vote: string | null
  crowd_vote_count: string
  judge_vote_count: string
  total_crowd_votes: string
  crowd_noise_energy: string | null
  crowd_noise_peak: string | null
  crowd_score: number | null
}

/**
 * Check if finalized results exist for an event
 */
export async function hasFinalizedResults(eventId: string): Promise<boolean> {
  const { rows } = await sql<{ count: number }>`
    SELECT COUNT(*) as count FROM finalized_results 
    WHERE event_id = ${eventId}
  `
  return Number(rows[0]?.count) > 0
}

/**
 * Get finalized results for an event from the finalized_results table
 *
 * ⚠️ IMPORTANT: Always use this for finalized events instead of getBandScores()
 *
 * Finalized results are:
 * - Pre-calculated and stored when an event is finalized
 * - Frozen at finalization time (won't change if votes are modified)
 * - Much faster to query (simple SELECT vs complex aggregations)
 * - The source of truth for finalized events
 *
 * Pattern:
 * ```typescript
 * if (event.status === 'finalized' && await hasFinalizedResults(eventId)) {
 *   const results = await getFinalizedResults(eventId);
 *   // Use finalized results
 * } else {
 *   const scores = await getBandScores(eventId);
 *   // Calculate dynamically
 * }
 * ```
 *
 * @param eventId - The event ID
 * @returns Array of finalized results, sorted by final_rank (winner first)
 *
 * @see getBandScores - Use this only for non-finalized events
 * @see hasFinalizedResults - Check if finalized results exist
 * @see finalizeEventResults - Function that creates finalized results
 */
export async function getFinalizedResults(
  eventId: string
): Promise<FinalizedResult[]> {
  const { rows } = await sql<FinalizedResult>`
    SELECT * FROM finalized_results 
    WHERE event_id = ${eventId}
    ORDER BY final_rank ASC
  `
  return rows
}

/**
 * A band's final score, as it will be (or was) frozen into `finalized_results`.
 */
export interface BandStanding {
  band_id: string
  band_name: string
  /** 1-based; exact ties keep running order (the earlier band ranks higher). */
  rank: number
  /** Level with the band ranked directly above it, to two decimal places. */
  tiedWithPrevious: boolean
  songChoice: number
  performance: number
  crowdVibe: number
  visuals: number
  crowdVoteCount: number
  judgeVoteCount: number
  totalCrowdVotes: number
  crowdNoiseEnergy: string | null
  crowdNoisePeak: string | null
  crowdVoteScore: number
  judgeScore: number
  screamOMeterScore: number
  visualsScore: number
  totalScore: number
}

/**
 * Totals are stored and shown to two decimal places, so two bands whose totals
 * round to the same value are level as far as anyone reading the results can
 * tell. They are still ranked by the unrounded total (then by running order).
 */
function isLevel(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100)
}

/**
 * Turn raw per-band score rows into ranked standings.
 *
 * Pure: the "Run the night" preview and `finalizeEventResults` both call this,
 * so the provisional standings an admin checks are exactly what gets frozen.
 *
 * `scores` must be in running order (as `getBandScores` returns them): the
 * sort is stable, so tied bands keep that order.
 */
export function calculateStandings(
  scores: BandScoreRow[],
  scoringVersion: string
): BandStanding[] {
  // Find the maximum vote count among all bands for normalization
  const maxVoteCount = Math.max(
    0,
    ...scores.map((s) => Number(s.crowd_vote_count || 0))
  )

  // Crowd-vote weight comes from the version's config (10 in 2025.1/2026.1,
  // 20 in 2026.2), so the leader earns the right number of points.
  const normalizedVersion = parseScoringVersion({
    scoring_version: scoringVersion,
  })
  const crowdVoteMax =
    getCategoryById(normalizedVersion, 'crowd_vote')?.maxPoints ?? 10

  // Calculate final scores and rankings based on scoring version
  const bandResults = scores.map((score) => {
    const songChoice = Number(score.avg_song_choice || 0)
    const performance = Number(score.avg_performance || 0)
    const crowdVibe = Number(score.avg_crowd_vibe || 0)
    const visuals = Number(score.avg_visuals || 0)

    // Normalized crowd vote score (leader gets the full weight)
    const crowdVoteScore =
      maxVoteCount > 0
        ? (Number(score.crowd_vote_count || 0) / maxVoteCount) * crowdVoteMax
        : 0

    // Version-specific scoring
    let judgeScore: number
    let totalScore: number
    let screamOMeterScore = 0
    let visualsScore = 0

    if (scoringVersion === '2022.1') {
      // No scoring for 2022.1 - winner is manually set
      judgeScore = 0
      totalScore = 0
    } else if (scoringVersion === '2025.1') {
      // 2025.1: Song(20) + Perf(30) + Vibe(30) + Vote(10) + Scream-o-meter(10) = 100
      judgeScore = songChoice + performance + crowdVibe
      screamOMeterScore = score.crowd_score ? Number(score.crowd_score) : 0
      totalScore = judgeScore + crowdVoteScore + screamOMeterScore
    } else {
      // 2026.1: Song(20) + Perf(30) + Vibe(20) + Vote(10) + Visuals(20) = 100
      // 2026.2: Song(20) + Perf(20) + Vibe(20) + Vote(20) + Visuals(20) = 100
      judgeScore = songChoice + performance + crowdVibe + visuals
      visualsScore = visuals
      totalScore = judgeScore + crowdVoteScore
    }

    return {
      band_id: score.id,
      band_name: score.name,
      songChoice,
      performance,
      crowdVibe,
      visuals,
      crowdVoteCount: Number(score.crowd_vote_count || 0),
      judgeVoteCount: Number(score.judge_vote_count || 0),
      totalCrowdVotes: Number(score.total_crowd_votes || 0),
      crowdNoiseEnergy: score.crowd_noise_energy,
      crowdNoisePeak: score.crowd_noise_peak,
      crowdVoteScore,
      judgeScore,
      screamOMeterScore,
      visualsScore,
      totalScore,
    }
  })

  // Sort by total score (descending)
  bandResults.sort((a, b) => b.totalScore - a.totalScore)

  return bandResults.map((band, i) => ({
    ...band,
    rank: i + 1,
    tiedWithPrevious:
      i > 0 && isLevel(bandResults[i - 1].totalScore, band.totalScore),
  }))
}

/** Bands sharing the top total, in rank order. A single name means no tie. */
export function getTiedForFirst(standings: BandStanding[]): string[] {
  if (standings.length === 0) return []
  const tied = [standings[0].band_name]
  for (let i = 1; i < standings.length && standings[i].tiedWithPrevious; i++) {
    tied.push(standings[i].band_name)
  }
  return tied
}

/**
 * Current standings for an event, calculated from the live votes.
 */
export async function getLiveStandings(
  eventId: string,
  scoringVersion: string
): Promise<BandStanding[]> {
  const scores = (await getBandScores(eventId)) as BandScoreRow[]
  return calculateStandings(scores, scoringVersion)
}

/**
 * Calculate and store finalized results for an event
 * This should be called when an event is finalized
 */
export async function finalizeEventResults(
  eventId: string,
  scoringVersion: string = '2025.1'
): Promise<FinalizedResult[]> {
  // Get the current scores
  const scores = (await getBandScores(eventId)) as BandScoreRow[]

  if (scores.length === 0) {
    return []
  }

  const standings = calculateStandings(scores, scoringVersion)

  // Delete any existing finalized results for this event
  await sql`DELETE FROM finalized_results WHERE event_id = ${eventId}`

  // Insert the finalized results
  const results: FinalizedResult[] = []
  for (const band of standings) {
    const { rows } = await sql<FinalizedResult>`
      INSERT INTO finalized_results (
        event_id, band_id, band_name, final_rank,
        avg_song_choice, avg_performance, avg_crowd_vibe, avg_visuals,
        crowd_vote_count, judge_vote_count, total_crowd_votes,
        crowd_noise_energy, crowd_noise_peak, crowd_noise_score,
        judge_score, crowd_score, visuals_score, total_score
      ) VALUES (
        ${eventId}, ${band.band_id}, ${band.band_name}, ${band.rank},
        ${band.songChoice}, ${band.performance}, ${band.crowdVibe}, ${
          band.visuals || null
        },
        ${band.crowdVoteCount}, ${band.judgeVoteCount}, ${band.totalCrowdVotes},
        ${band.crowdNoiseEnergy || null}, ${band.crowdNoisePeak || null}, ${
          band.screamOMeterScore || null
        },
        ${band.judgeScore}, ${band.crowdVoteScore}, ${
          band.visualsScore || null
        }, ${band.totalScore}
      )
      RETURNING *
    `
    results.push(rows[0])
  }

  return results
}

/**
 * Delete finalized results for an event
 */
export async function deleteFinalizedResults(eventId: string): Promise<void> {
  await sql`DELETE FROM finalized_results WHERE event_id = ${eventId}`
}
