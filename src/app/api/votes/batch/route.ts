import { NextRequest, NextResponse } from "next/server";
import { submitVote, updateVote } from "@/lib/db";
import {
  extractUserContext,
  hasUserVoted,
  hasUserVotedByFingerprintJS,
} from "@/lib/user-context-server";
import { withAdminProtection } from "@/lib/api-protection";

async function handleBatchVotes(request: NextRequest) {
  try {
    const {
      votes,
      fingerprintjs_visitor_id,
      fingerprintjs_confidence: fpConfidenceFromBody,
      fingerprintjs_confidence_comment: fpConfidenceCommentFromBody,
    } = await request.json();

    if (!Array.isArray(votes)) {
      return NextResponse.json(
        { error: "Invalid votes data" },
        { status: 400 }
      );
    }

    if (votes.length === 0) {
      return NextResponse.json({ votes: [] });
    }

    // Extract user context from request
    const userContext = extractUserContext(request);

    // Extract FingerprintJS data from headers and body
    const fingerprintjsVisitorId =
      request.headers.get("X-FingerprintJS-Visitor-ID") ||
      fingerprintjs_visitor_id;
    const fingerprintjsConfidence =
      request.headers.get("X-FingerprintJS-Confidence") || fpConfidenceFromBody;
    const fingerprintjsConfidenceComment =
      request.headers.get("X-FingerprintJS-Confidence-Comment") ||
      fpConfidenceCommentFromBody;

    // Add FingerprintJS data to user context
    if (fingerprintjsVisitorId) {
      userContext.fingerprintjs_visitor_id = fingerprintjsVisitorId;
    }
    if (fingerprintjsConfidence) {
      userContext.fingerprintjs_confidence = parseFloat(
        fingerprintjsConfidence
      );
    }
    if (fingerprintjsConfidenceComment) {
      userContext.fingerprintjs_confidence_comment =
        fingerprintjsConfidenceComment;
    }
    // No longer storing components - just the essential fingerprint data

    // Check if user has already voted for any event in this batch
    // First check with FingerprintJS visitor ID (more accurate)
    if (userContext.fingerprintjs_visitor_id) {
      for (const vote of votes) {
        const alreadyVotedByFingerprintJS = await hasUserVotedByFingerprintJS(
          vote.event_id,
          userContext.fingerprintjs_visitor_id
        );
        if (alreadyVotedByFingerprintJS) {
          return NextResponse.json(
            { error: `You have already voted for event ${vote.event_id}` },
            { status: 409 }
          );
        }
      }
    }

    // Fallback to custom fingerprint
    if (userContext.vote_fingerprint) {
      for (const vote of votes) {
        const alreadyVoted = await hasUserVoted(
          vote.event_id,
          userContext.vote_fingerprint
        );
        if (alreadyVoted) {
          return NextResponse.json(
            { error: `You have already voted for event ${vote.event_id}` },
            { status: 409 }
          );
        }
      }
    }

    // Submit all votes with user context
    const submittedVotes = [];
    for (const vote of votes) {
      const voteWithContext = {
        ...vote,
        ...userContext,
      };

      // Check if this specific vote has a cookie (for updates)
      const hasVotingCookie = request.cookies.get(`voted_${vote.event_id}`);
      const submittedVote = hasVotingCookie
        ? await updateVote(voteWithContext)
        : await submitVote(voteWithContext);
      submittedVotes.push(submittedVote);
    }

    // Set voting cookies for all events
    const response = NextResponse.json({ votes: submittedVotes });
    const uniqueEventIds = [...new Set(votes.map((v) => v.event_id))];

    for (const eventId of uniqueEventIds) {
      response.cookies.set(`voted_${eventId}`, "true", {
        maxAge: 30 * 24 * 60 * 60, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
    }

    return response;
  } catch (error) {
    console.error("Error submitting batch votes:", error);
    return NextResponse.json(
      { error: "Failed to submit votes" },
      { status: 500 }
    );
  }
}

export const POST = withAdminProtection(handleBatchVotes);
