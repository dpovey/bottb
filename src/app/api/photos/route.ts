import { NextRequest, NextResponse } from "next/server";
import {
  getPhotos,
  getPhotoCount,
  getDistinctPhotographers,
  getDistinctCompanies,
  getAvailablePhotoFilters,
} from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    // Support both new (event, band) and legacy (eventId, bandId) param names
    const eventId =
      searchParams.get("event") || searchParams.get("eventId") || undefined;
    const bandId =
      searchParams.get("band") || searchParams.get("bandId") || undefined;
    const photographer = searchParams.get("photographer") || undefined;
    // Support both company and companySlug for backwards compatibility
    const companySlug =
      searchParams.get("company") ||
      searchParams.get("companySlug") ||
      undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = (page - 1) * limit;

    const [photos, total, photographers, companies, availableFilters] =
      await Promise.all([
        getPhotos({
          eventId,
          bandId,
          photographer,
          companySlug,
          limit,
          offset,
        }),
        getPhotoCount({ eventId, bandId, photographer, companySlug }),
        getDistinctPhotographers(),
        getDistinctCompanies(),
        getAvailablePhotoFilters({
          eventId,
          bandId,
          photographer,
          companySlug,
        }),
      ]);

    return NextResponse.json({
      photos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      photographers,
      companies,
      availableFilters,
    });
  } catch (error) {
    console.error("Error fetching photos:", error);
    return NextResponse.json(
      { error: "Failed to fetch photos" },
      { status: 500 }
    );
  }
}
