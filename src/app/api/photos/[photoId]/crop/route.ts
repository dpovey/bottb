import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { withAdminProtection, ProtectedApiHandler } from "@/lib/api-protection";

interface PhotoRow {
  id: string;
  blob_url: string;
  blob_pathname: string;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

const handleCropPhoto: ProtectedApiHandler = async (
  request: NextRequest,
  _context?: unknown
) => {
  try {
    // Extract photoId from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const photoId = pathParts[pathParts.length - 2]; // /api/photos/{photoId}/crop

    if (!photoId) {
      return NextResponse.json(
        { error: "Photo ID is required" },
        { status: 400 }
      );
    }

    // Parse crop area from request body
    const body = await request.json();
    const cropArea: CropArea = body.cropArea;

    if (!cropArea || typeof cropArea.x !== "number" || typeof cropArea.y !== "number" ||
        typeof cropArea.width !== "number" || typeof cropArea.height !== "number") {
      return NextResponse.json(
        { error: "Invalid crop area. Required: { x, y, width, height }" },
        { status: 400 }
      );
    }

    // Get photo from database
    const { rows } = await sql<PhotoRow>`
      SELECT id, blob_url, blob_pathname FROM photos WHERE id = ${photoId}
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Photo not found" },
        { status: 404 }
      );
    }

    const photo = rows[0];

    // Fetch the large image from blob storage
    const largeImageResponse = await fetch(photo.blob_url);
    if (!largeImageResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch original image" },
        { status: 500 }
      );
    }

    const largeImageBuffer = Buffer.from(await largeImageResponse.arrayBuffer());

    // Get original image dimensions
    const metadata = await sharp(largeImageBuffer).metadata();
    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.height || 0;

    // Convert percentage-based crop coordinates to pixels
    // react-easy-crop returns values as percentages of the image
    const pixelCrop = {
      left: Math.round((cropArea.x / 100) * originalWidth),
      top: Math.round((cropArea.y / 100) * originalHeight),
      width: Math.round((cropArea.width / 100) * originalWidth),
      height: Math.round((cropArea.height / 100) * originalHeight),
    };

    // Ensure crop is within bounds
    pixelCrop.left = Math.max(0, Math.min(pixelCrop.left, originalWidth - pixelCrop.width));
    pixelCrop.top = Math.max(0, Math.min(pixelCrop.top, originalHeight - pixelCrop.height));

    // Create new thumbnail with custom crop
    const newThumbnail = await sharp(largeImageBuffer)
      .extract(pixelCrop)
      .resize(300, 300, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();

    // Use unique filename to bypass CDN cache
    const timestamp = Date.now();
    const thumbnailPath = `photos/${photoId}/thumbnail-${timestamp}.webp`;
    const newThumbnailBlob = await put(thumbnailPath, newThumbnail, {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: false,
    });

    // Store new thumbnail URL in database
    await sql`
      UPDATE photos 
      SET xmp_metadata = jsonb_set(
        jsonb_set(
          COALESCE(xmp_metadata, '{}'::jsonb),
          '{thumbnail_version}',
          ${JSON.stringify(timestamp)}::jsonb
        ),
        '{thumbnail_url}',
        ${JSON.stringify(newThumbnailBlob.url)}::jsonb
      )
      WHERE id = ${photoId}
    `;

    return NextResponse.json({
      success: true,
      message: "Thumbnail cropped successfully",
      thumbnailUrl: newThumbnailBlob.url, // Return the actual new URL (no query params needed)
    });
  } catch (error) {
    console.error("Error cropping photo:", error);
    return NextResponse.json(
      { error: "Failed to crop photo" },
      { status: 500 }
    );
  }
};

// Only admins can crop photos
export const POST = withAdminProtection(handleCropPhoto);

