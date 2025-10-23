import { put, del, list, head } from "@vercel/blob";

export interface BlobUploadResult {
  url: string;
  downloadUrl: string;
  pathname: string;
  contentType: string;
  contentDisposition: string;
  size: number;
}

export interface BlobListResult {
  blobs: Array<{
    url: string;
    downloadUrl: string;
    pathname: string;
    size: number;
    uploadedAt: Date;
  }>;
  hasMore: boolean;
  cursor?: string;
}

/**
 * Upload an image file to Vercel Blob storage
 */
export async function uploadImage(
  file: File | Buffer,
  filename: string,
  options?: {
    access?: "public" | "private";
    addRandomSuffix?: boolean;
    cacheControlMaxAge?: number;
  }
): Promise<BlobUploadResult> {
  try {
    const blob = await put(filename, file, {
      access: "public", // Vercel blob only supports public access
      addRandomSuffix: options?.addRandomSuffix ?? true,
      cacheControlMaxAge: options?.cacheControlMaxAge || 31536000, // 1 year
    });

    return {
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      pathname: blob.pathname,
      contentType: blob.contentType,
      contentDisposition: blob.contentDisposition,
      size: 0, // Vercel blob doesn't return size in PutBlobResult
    };
  } catch (error) {
    console.error("Error uploading image to blob storage:", error);
    throw new Error("Failed to upload image");
  }
}

/**
 * Delete an image from Vercel Blob storage
 */
export async function deleteImage(url: string): Promise<void> {
  try {
    await del(url);
  } catch (error) {
    console.error("Error deleting image from blob storage:", error);
    throw new Error("Failed to delete image");
  }
}

/**
 * Get image metadata from Vercel Blob storage
 */
export async function getImageMetadata(url: string) {
  try {
    const blob = await head(url);
    return {
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      pathname: blob.pathname,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
      contentType: blob.contentType,
    };
  } catch (error) {
    console.error("Error getting image metadata:", error);
    throw new Error("Failed to get image metadata");
  }
}

/**
 * List images in blob storage with optional prefix filter
 */
export async function listImages(
  prefix?: string,
  limit?: number,
  cursor?: string
): Promise<BlobListResult> {
  try {
    const result = await list({
      prefix,
      limit: limit || 100,
      cursor,
    });

    return {
      blobs: result.blobs,
      hasMore: result.hasMore,
      cursor: result.cursor,
    };
  } catch (error) {
    console.error("Error listing images:", error);
    throw new Error("Failed to list images");
  }
}

/**
 * List images by category for a specific entity
 */
export async function listImagesByCategory(
  entityType: "band" | "event" | "user",
  entityId: string,
  category?: string,
  limit?: number
): Promise<BlobListResult> {
  const prefix = category
    ? `${entityType}s/${entityId}/${category}/`
    : `${entityType}s/${entityId}/`;

  return listImages(prefix, limit);
}

/**
 * Get band logo URL from blob storage
 */
export async function getBandLogoUrl(bandId: string): Promise<string | null> {
  try {
    const result = await listImages(`bands/${bandId}/logo/`, 1);

    if (result.blobs.length > 0) {
      return result.blobs[0].url;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching logo for band ${bandId}:`, error);
    return null;
  }
}

/**
 * Get event banner URL from blob storage
 */
export async function getEventBannerUrl(
  eventId: string
): Promise<string | null> {
  try {
    const result = await listImages(`events/${eventId}/banner/`, 1);

    if (result.blobs.length > 0) {
      return result.blobs[0].url;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching banner for event ${eventId}:`, error);
    return null;
  }
}

/**
 * Get event image URL from blob storage
 */
export async function getEventImageUrl(
  eventId: string
): Promise<string | null> {
  try {
    const result = await listImages(`events/${eventId}/image/`, 1);

    if (result.blobs.length > 0) {
      return result.blobs[0].url;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching image for event ${eventId}:`, error);
    return null;
  }
}

/**
 * Clean up old temporary uploads (older than 24 hours)
 */
export async function cleanupTempUploads(): Promise<number> {
  try {
    const result = await listImages("temp/uploads/", 1000);
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
    let deletedCount = 0;

    for (const blob of result.blobs) {
      const filename = blob.pathname.split("/").pop() || "";
      const timestamp = parseInt(filename.split(".")[0]) || 0;

      if (timestamp < cutoffTime) {
        await deleteImage(blob.url);
        deletedCount++;
      }
    }

    return deletedCount;
  } catch (error) {
    console.error("Error cleaning up temp uploads:", error);
    throw new Error("Failed to cleanup temp uploads");
  }
}

/**
 * Generate a unique filename for band images
 */
export function generateBandImageFilename(
  bandId: string,
  originalName: string,
  category: "profile" | "logo" | "performance" | "gallery" = "profile"
): string {
  const timestamp = Date.now();
  const extension = originalName.split(".").pop() || "jpg";
  return `bands/${bandId}/${category}/${timestamp}.${extension}`;
}

/**
 * Generate a unique filename for event images
 */
export function generateEventImageFilename(
  eventId: string,
  originalName: string,
  category: "banner" | "flyer" | "gallery" | "sponsor" | "image" = "banner"
): string {
  const timestamp = Date.now();
  const extension = originalName.split(".").pop() || "jpg";
  return `events/${eventId}/${category}/${timestamp}.${extension}`;
}

/**
 * Generate a unique filename for user avatars
 */
export function generateUserImageFilename(
  userId: string,
  originalName: string
): string {
  const timestamp = Date.now();
  const extension = originalName.split(".").pop() || "jpg";
  return `users/${userId}/avatar/${timestamp}.${extension}`;
}

/**
 * Generate a unique filename for temporary uploads
 */
export function generateTempImageFilename(
  originalName: string,
  sessionId?: string
): string {
  const timestamp = Date.now();
  const extension = originalName.split(".").pop() || "jpg";
  const session = sessionId || "anonymous";
  return `temp/uploads/${session}/${timestamp}.${extension}`;
}

/**
 * Validate image file type and size
 */
export function validateImageFile(file: File): {
  valid: boolean;
  error?: string;
} {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: "Invalid file type. Only JPEG, PNG, and WebP images are allowed.",
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: "File too large. Maximum size is 5MB.",
    };
  }

  return { valid: true };
}
