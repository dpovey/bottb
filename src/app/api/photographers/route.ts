import { NextResponse } from "next/server";
import { getPhotographers } from "@/lib/db";

export async function GET() {
  try {
    const photographers = await getPhotographers();
    return NextResponse.json(photographers);
  } catch (error) {
    console.error("Error fetching photographers:", error);
    return NextResponse.json(
      { error: "Failed to fetch photographers" },
      { status: 500 }
    );
  }
}



