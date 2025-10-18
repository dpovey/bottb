import { NextRequest, NextResponse } from "next/server";
import { getPastEvents } from "@/lib/db";
import { withPublicRateLimit } from "@/lib/api-protection";

async function handleGetPastEvents(_request: NextRequest) {
  try {
    const pastEvents = await getPastEvents();
    return NextResponse.json(pastEvents);
  } catch (error) {
    console.error("Error fetching past events:", error);
    return NextResponse.json(
      { error: "Failed to fetch past events" },
      { status: 500 }
    );
  }
}

export const GET = withPublicRateLimit(handleGetPastEvents);
