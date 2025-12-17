import { NextRequest, NextResponse } from "next/server";
import { getPhotosByLabel, PHOTO_LABELS, PhotoLabel } from "@/lib/db";

// Valid labels
const VALID_LABELS = new Set(Object.values(PHOTO_LABELS));

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const label = searchParams.get("label");
    const eventId = searchParams.get("eventId") || undefined;
    const bandId = searchParams.get("bandId") || undefined;

    // Validate label parameter
    if (!label) {
      return NextResponse.json(
        { 
          error: "Label parameter is required",
          validLabels: Object.values(PHOTO_LABELS),
        },
        { status: 400 }
      );
    }

    if (!VALID_LABELS.has(label as PhotoLabel)) {
      return NextResponse.json(
        { 
          error: "Invalid label",
          validLabels: Object.values(PHOTO_LABELS),
        },
        { status: 400 }
      );
    }

    // Fetch photos by label with optional entity filter
    const photos = await getPhotosByLabel(label, { eventId, bandId });

    return NextResponse.json({
      photos,
      count: photos.length,
      label,
      filters: {
        eventId: eventId || null,
        bandId: bandId || null,
      },
    });
  } catch (error) {
    console.error("Error fetching hero photos:", error);
    return NextResponse.json(
      { error: "Failed to fetch hero photos" },
      { status: 500 }
    );
  }
}




