import { NextResponse } from "next/server";
import { getUpcomingEvents } from "@/lib/db";

export async function GET() {
  try {
    const upcomingEvents = await getUpcomingEvents();
    return NextResponse.json(upcomingEvents);
  } catch (error) {
    console.error("Error fetching upcoming events:", error);
    return NextResponse.json(
      { error: "Failed to fetch upcoming events" },
      { status: 500 }
    );
  }
}
