import { NextResponse } from "next/server";
import { getPastEvents } from "@/lib/db";

export async function GET() {
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

