import { NextRequest, NextResponse } from "next/server";
import { getBandScores } from "@/lib/db";
import { withPublicRateLimit } from "@/lib/api-protection";

async function handleGetScores(request: NextRequest, _context?: unknown) {
  try {
    // Extract eventId from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const eventId = pathParts[pathParts.length - 2]; // scores is the last part, eventId is before it

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
