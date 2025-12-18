import { NextResponse } from "next/server";
import { getPhotographerBySlug } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const photographer = await getPhotographerBySlug(slug);

    if (!photographer) {
      return NextResponse.json(
        { error: "Photographer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(photographer);
  } catch (error) {
    console.error("Error fetching photographer:", error);
    return NextResponse.json(
      { error: "Failed to fetch photographer" },
      { status: 500 }
    );
  }
}




