import { NextRequest, NextResponse } from "next/server";
import { getBandsForEvent } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const bands = await getBandsForEvent(eventId);
    return NextResponse.json(bands);
  } catch (error) {
    console.error("Error fetching bands:", error);
    return NextResponse.json(
      { error: "Failed to fetch bands" },
      { status: 500 }
    );
  }
}
