import sharp from "sharp";

export interface ProcessedImage {
  thumbnail: Buffer;
  large: Buffer;
  width: number;
  height: number;
  fileSize: number;
  format: string;
}

export interface ImageVariant {
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
}

/**
 * Process an image buffer to create optimized variants
 * Creates only 2 variants to save storage:
 * - thumbnail: 300x300 cover crop for grid view
 * - large: max 2000px for slideshow/full view
 */
export async function processImage(
  imageBuffer: Buffer
): Promise<ProcessedImage> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  const originalWidth = metadata.width || 0;
  const originalHeight = metadata.height || 0;
  const originalSize = imageBuffer.byteLength;
  const format = metadata.format || "jpeg";

  // Create thumbnail (300x300 cover crop, WebP)
  const thumbnail = await image
    .clone()
    .resize(300, 300, { fit: "cover", position: "attention" })
    .webp({ quality: 80 })
    .toBuffer();

  // Create large version (max 2000px on longest side, WebP)
  const large = await image
    .clone()
    .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88 })
    .toBuffer();

  return {
    thumbnail,
    large,
    width: originalWidth,
    height: originalHeight,
    fileSize: originalSize,
    format,
  };
}

/**
 * Get image dimensions without full processing
 */
export async function getImageDimensions(
  imageBuffer: Buffer
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(imageBuffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

