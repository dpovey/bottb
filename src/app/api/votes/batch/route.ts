import { NextRequest, NextResponse } from "next/server";
import { submitVote } from "@/lib/db";
import { sql } from "@vercel/postgres";
import { withAdminProtection } from "@/lib/api-protection";

async function handleBatchVotes(request: NextRequest) {
  try {
    const { votes } = await request.json();

    if (!Array.isArray(votes)) {
      return NextResponse.json(
        { error: "Invalid votes data" },
        { status: 400 }
      );
    }

    if (votes.length === 0) {
      return NextResponse.json({ votes: [] });
    }

    // No fingerprinting for judge voting - admins can vote multiple times
    const userContext = {
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
      user_agent: request.headers.get("user-agent") || "unknown",
    };

    // Check for duplicate judge votes by name (check if judge already voted for any band in this event)
    if (votes.length > 0 && votes[0].voter_type === "judge") {
      const judgeName = votes[0].name;
      const eventId = votes[0].event_id;
      if (judgeName) {
        // Check if this judge has already voted for any band in this event
        const { rows } = await sql`
          SELECT COUNT(*) as count FROM votes 
          WHERE event_id = ${eventId} AND name = ${judgeName} AND voter_type = 'judge'
        `;
        if (rows[0]?.count > 0) {
          return NextResponse.json(
            { error: `Already recorded a vote for judge: ${judgeName}` },
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

      // For judge voting, always submit new votes (no cookie checking)
      const submittedVote = await submitVote(voteWithContext);
      submittedVotes.push(submittedVote);
    }

    // No cookies needed for judge voting - admins can vote multiple times
    return NextResponse.json({ votes: submittedVotes });
  } catch (error) {
    console.error("Error submitting batch votes:", error);
    return NextResponse.json(
      { error: "Failed to submit votes" },
      { status: 500 }
    );
  }
}

export const POST = withAdminProtection(handleBatchVotes);
