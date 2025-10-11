import { NextRequest, NextResponse } from "next/server";
import { getBandScores } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
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
