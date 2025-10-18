import { NextRequest, NextResponse } from "next/server";
import { getUpcomingEvents, getPastEvents } from "@/lib/db";
import { withAdminProtection } from "@/lib/api-protection";

async function handleGetEvents(_request: NextRequest) {
  try {
    const [upcomingEvents, pastEvents] = await Promise.all([
      getUpcomingEvents(),
      getPastEvents(),
    ]);

    // Combine all events and sort by date (newest first)
    const allEvents = [...upcomingEvents, ...pastEvents].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return NextResponse.json(allEvents);
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

// Admin-only endpoint to get all events
export const GET = withAdminProtection(handleGetEvents);
