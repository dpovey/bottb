/**
 * Photo JPEG Conversion Endpoint
 *
 * GET /api/photos/[photoId]/jpeg - Serve photo as JPEG at full resolution
 *
 * Query params:
 * - quality: JPEG quality 1-100 (default: 95)
 * - maxWidth: Maximum width in pixels (optional, preserves aspect ratio)
 *
 * Used for Instagram posting which requires JPEG format.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPhotoById } from "@/lib/db";
import sharp from "sharp";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { photoId } = await params;

  try {
    const photo = await getPhotoById(photoId);

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const quality = Math.min(100, Math.max(1, parseInt(searchParams.get("quality") || "95", 10)));
    const maxWidth = searchParams.get("maxWidth")
      ? parseInt(searchParams.get("maxWidth")!, 10)
      : undefined;

    // Fetch the original image
    const imageResponse = await fetch(photo.blob_url);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch original image" },
        { status: 500 }
      );
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Convert to JPEG using sharp
    let sharpInstance = sharp(imageBuffer);

    // Optionally resize while preserving aspect ratio
    if (maxWidth) {
      sharpInstance = sharpInstance.resize({
        width: maxWidth,
        withoutEnlargement: true,
      });
    }

    const jpegBuffer = await sharpInstance
      .jpeg({
        quality,
        mozjpeg: true, // Better compression
      })
      .toBuffer();

    // Return JPEG with appropriate headers
    // Convert Buffer to Uint8Array for NextResponse compatibility
    return new NextResponse(new Uint8Array(jpegBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": jpegBuffer.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="${photo.original_filename?.replace(/\.[^.]+$/, ".jpg") || `photo-${photoId}.jpg`}"`,
      },
    });
  } catch (error) {
    console.error("JPEG conversion error:", error);
    return NextResponse.json(
      { error: "Failed to convert image" },
      { status: 500 }
    );
  }
}

