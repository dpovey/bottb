import { sql } from '../sql'
import type { FinalizedResult } from '../db-types'
import { getBandScores } from './events'

// ============================================================
// Finalized Results Functions
// ============================================================

interface BandScoreRow {
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

  // Find the maximum vote count among all bands for normalization
  const maxVoteCount = Math.max(
    ...scores.map((s) => Number(s.crowd_vote_count || 0))
  )

  // Calculate final scores and rankings based on scoring version
  const bandResults = scores.map((score) => {
    const songChoice = Number(score.avg_song_choice || 0)
    const performance = Number(score.avg_performance || 0)
    const crowdVibe = Number(score.avg_crowd_vibe || 0)
    const visuals = Number(score.avg_visuals || 0)

    // Normalized crowd vote score (max 10 points)
    const crowdVoteScore =
      maxVoteCount > 0
        ? (Number(score.crowd_vote_count || 0) / maxVoteCount) * 10
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
      judgeScore = songChoice + performance + crowdVibe + visuals
      visualsScore = visuals
      totalScore = judgeScore + crowdVoteScore
    }

    return {
      ...score,
      songChoice,
      performance,
      crowdVibe,
      visuals,
      crowdVoteScore,
      judgeScore,
      screamOMeterScore,
      visualsScore,
      totalScore,
    }
  })

  // Sort by total score (descending)
  bandResults.sort((a, b) => b.totalScore - a.totalScore)

  // Delete any existing finalized results for this event
  await sql`DELETE FROM finalized_results WHERE event_id = ${eventId}`

  // Insert the finalized results
  const results: FinalizedResult[] = []
  for (let i = 0; i < bandResults.length; i++) {
    const band = bandResults[i]
    const finalRank = i + 1

    const { rows } = await sql<FinalizedResult>`
      INSERT INTO finalized_results (
        event_id, band_id, band_name, final_rank,
        avg_song_choice, avg_performance, avg_crowd_vibe, avg_visuals,
        crowd_vote_count, judge_vote_count, total_crowd_votes,
        crowd_noise_energy, crowd_noise_peak, crowd_noise_score,
        judge_score, crowd_score, visuals_score, total_score
      ) VALUES (
        ${eventId}, ${band.id}, ${band.name}, ${finalRank},
        ${band.songChoice}, ${band.performance}, ${band.crowdVibe}, ${
          band.visuals || null
        },
        ${Number(band.crowd_vote_count || 0)}, ${Number(
          band.judge_vote_count || 0
        )}, ${Number(band.total_crowd_votes || 0)},
        ${band.crowd_noise_energy || null}, ${band.crowd_noise_peak || null}, ${
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
