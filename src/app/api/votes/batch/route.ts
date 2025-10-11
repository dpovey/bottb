import { NextRequest, NextResponse } from "next/server";
import { submitVote } from "@/lib/db";

export async function POST(request: NextRequest) {
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

    // Submit all votes
    const submittedVotes = [];
    for (const vote of votes) {
      const submittedVote = await submitVote(vote);
      submittedVotes.push(submittedVote);
    }

    return NextResponse.json({ votes: submittedVotes });
  } catch (error) {
    console.error("Error submitting batch votes:", error);
    return NextResponse.json(
      { error: "Failed to submit votes" },
      { status: 500 }
    );
  }
}
