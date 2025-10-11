import { NextResponse } from "next/server";
import { getActiveEvent } from "@/lib/db";

export async function GET() {
  try {
    const activeEvent = await getActiveEvent();
    return NextResponse.json(activeEvent);
  } catch (error) {
    console.error("Error fetching active event:", error);
    return NextResponse.json(
      { error: "Failed to fetch active event" },
      { status: 500 }
    );
  }
}
