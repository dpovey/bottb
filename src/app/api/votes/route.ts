import { NextRequest, NextResponse } from "next/server";
import { submitVote } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const vote = await submitVote(body);
    return NextResponse.json(vote);
  } catch (error) {
    console.error("Error submitting vote:", error);
    return NextResponse.json(
      { error: "Failed to submit vote" },
      { status: 500 }
    );
  }
}

