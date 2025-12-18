import { NextRequest, NextResponse } from "next/server";
import {
  getBandScores,
  getEventById,
  hasFinalizedResults,
  getFinalizedResults,
} from "@/lib/db";
import { withPublicRateLimit } from "@/lib/api-protection";

async function handleGetScores(request: NextRequest, _context?: unknown) {
  try {
    // Extract eventId from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const eventId = pathParts[pathParts.length - 2]; // scores is the last part, eventId is before it

    // Check if event is finalized and has finalized results
    const event = await getEventById(eventId);
    if (
      event &&
      event.status === "finalized" &&
      (await hasFinalizedResults(eventId))
    ) {
      // Return finalized results
      const finalizedResults = await getFinalizedResults(eventId);
      // Transform to match expected format (similar to getBandScores output)
      const scores = finalizedResults.map((result) => ({
        id: result.band_id,
        name: result.band_name,
        order: result.final_rank,
        avg_song_choice: result.avg_song_choice,
        avg_performance: result.avg_performance,
        avg_crowd_vibe: result.avg_crowd_vibe,
        avg_visuals: result.avg_visuals,
        avg_crowd_vote: null, // Not stored in finalized results
        crowd_vote_count: result.crowd_vote_count,
        judge_vote_count: result.judge_vote_count,
        total_crowd_votes: result.total_crowd_votes,
        crowd_noise_energy: result.crowd_noise_energy,
        crowd_noise_peak: result.crowd_noise_peak,
        crowd_score: result.crowd_noise_score,
      }));
      return NextResponse.json(scores);
    }

    // For non-finalized events, calculate scores dynamically
    const scores = await getBandScores(eventId);
    return NextResponse.json(scores);
  } catch (error) {
    console.error("Error fetching band scores:", error);
    return NextResponse.json(
      { error: "Failed to fetch band scores" },
      { status: 500 }
    );
  }
}

export const GET = withPublicRateLimit(handleGetScores);
