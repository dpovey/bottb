import { NextRequest, NextResponse } from "next/server";
import { submitVote, updateVote } from "@/lib/db";
import { sql } from "@vercel/postgres";
import {
  extractUserContext,
  hasUserVoted,
  hasUserVotedByFingerprintJS,
} from "@/lib/user-context";

export async function POST(request: NextRequest) {
  try {
    const {
      event_id,
      band_id,
      voter_type,
      song_choice,
      performance,
      crowd_vibe,
      crowd_vote,
      fingerprintjs_visitor_id,
      fingerprintjs_confidence,
      fingerprintjs_confidence_comment,
    } = await request.json();

    // Extract user context from request
    const userContext = extractUserContext(request);

    // Add FingerprintJS data to user context
    if (fingerprintjs_visitor_id) {
      userContext.fingerprintjs_visitor_id = fingerprintjs_visitor_id;
    }
    if (fingerprintjs_confidence) {
      userContext.fingerprintjs_confidence = fingerprintjs_confidence;
    }
    if (fingerprintjs_confidence_comment) {
      userContext.fingerprintjs_confidence_comment =
        fingerprintjs_confidence_comment;
    }

    // Check for voting cookie first - if exists, allow update
    const existingCookie = request.cookies.get(`voted_${event_id}`);
    // Debug logging removed for tests

    // Only check fingerprints if no cookie exists (new vote)
    if (!existingCookie) {
      // Check for duplicate votes using fingerprints (these should block)
      if (userContext.fingerprintjs_visitor_id) {
        const alreadyVotedByFingerprintJS = await hasUserVotedByFingerprintJS(
          event_id,
          userContext.fingerprintjs_visitor_id
        );
        if (alreadyVotedByFingerprintJS) {
          return NextResponse.json(
            { error: "You have already voted for this event" },
            { status: 409 }
          );
        }
      }

      // Fallback to custom fingerprint
      if (userContext.vote_fingerprint) {
        const alreadyVoted = await hasUserVoted(
          event_id,
          userContext.vote_fingerprint
        );
        if (alreadyVoted) {
          return NextResponse.json(
            { error: "You have already voted for this event" },
            { status: 409 }
          );
        }
      }
    }

    const voteWithContext = {
      event_id,
      band_id,
      voter_type,
      song_choice,
      performance,
      crowd_vibe,
      crowd_vote,
      ...userContext,
    };

    // Submit or update vote based on cookie presence
    const vote = existingCookie
      ? await updateVote(voteWithContext)
      : await submitVote(voteWithContext);

    // Always set/update the voting cookie with vote data
    const response = NextResponse.json(vote);

    // Get band name from database
    const { rows: bandRows } = await sql`
      SELECT name FROM bands WHERE id = ${band_id}
    `;
    const bandName = bandRows[0]?.name || "Unknown Band";
    const voteData = JSON.stringify({ bandId: band_id, bandName });

    response.cookies.set(`voted_${event_id}`, voteData, {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      httpOnly: false, // Allow client-side access to read vote data
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("Error submitting vote:", error);
    return NextResponse.json(
      { error: "Failed to submit vote" },
      { status: 500 }
    );
  }
}
