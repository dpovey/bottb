import { NextRequest, NextResponse } from "next/server";
import {
  uploadImage,
  validateImageFile,
  generateBandImageFilename,
  generateEventImageFilename,
  generateUserImageFilename,
} from "@/lib/blob";
import { requireAdminAuth } from "@/lib/api-protection";

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    await requireAdminAuth(request);

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string; // 'band', 'event', or 'user'
    const entityId = formData.get("entityId") as string; // entity ID
    const category = formData.get("category") as string; // optional category

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!type || !["band", "event", "user"].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "band", "event", or "user"' },
        { status: 400 }
      );
    }

    if (!entityId) {
      return NextResponse.json(
        { error: "Entity ID is required" },
        { status: 400 }
      );
    }

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Generate filename based on type and category
    let filename: string;
    if (type === "band") {
      const bandCategory =
        (category as "profile" | "logo" | "performance" | "gallery") ||
        "profile";
      filename = generateBandImageFilename(entityId, file.name, bandCategory);
    } else if (type === "event") {
      const eventCategory =
        (category as "banner" | "flyer" | "gallery" | "sponsor") || "banner";
      filename = generateEventImageFilename(entityId, file.name, eventCategory);
    } else if (type === "user") {
      filename = generateUserImageFilename(entityId, file.name);
    } else {
      throw new Error("Invalid type");
    }

    // Upload to blob storage
    const result = await uploadImage(file, filename, {
      access: "public",
      addRandomSuffix: true,
      cacheControlMaxAge: 31536000, // 1 year
    });

    return NextResponse.json({
      success: true,
      url: result.url,
      downloadUrl: result.downloadUrl,
      pathname: result.pathname,
      size: result.size,
      contentType: result.contentType,
    });
  } catch (error) {
    console.error("Image upload error:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Require admin authentication
    await requireAdminAuth(request);

    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get("url");

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    // Import delete function here to avoid circular dependency
    const { deleteImage } = await import("@/lib/blob");
    await deleteImage(imageUrl);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Image deletion error:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}
