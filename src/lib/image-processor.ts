import sharp from 'sharp'

export interface ProcessedImage {
  thumbnail: Buffer
  thumbnail2x?: Buffer // 600px for 2x displays
  thumbnail3x?: Buffer // 900px for 3x displays
  medium?: Buffer // 1200px for mobile slideshow (3x displays)
  large: Buffer
  large4k?: Buffer // 4000px for 4K displays
  width: number
  height: number
  fileSize: number
  format: string
}

export interface ImageVariant {
  buffer: Buffer
  width: number
  height: number
  size: number
}

/**
 * Process an image buffer to create optimized variants
 *
 * IMPORTANT: Thumbnails preserve aspect ratio (no cropping) so that CSS can
 * apply focal point positioning via object-position. This ensures the focal
 * point set by admins is respected when displaying photos in grids, cards, etc.
 *
 * Variants:
 * - thumbnail: max 400px on longest side (1x displays, ~400px grid cells)
 * - thumbnail2x: max 800px on longest side (2x/Retina displays)
 * - thumbnail3x: max 1200px on longest side (3x displays)
 * - medium: max 1600px (mobile slideshow at 3x density)
 * - large: max 2000px (tablet/desktop displays)
 * - large4k: max 4000px (4K displays)
 *
 * CSS handles cropping to container shape using object-fit: cover with
 * object-position set to the photo's hero_focal_point.
 */
export async function processImage(
  imageBuffer: Buffer
): Promise<ProcessedImage> {
  const image = sharp(imageBuffer)
  const metadata = await image.metadata()

  const originalWidth = metadata.width || 0
  const originalHeight = metadata.height || 0
  const originalSize = imageBuffer.byteLength
  const format = metadata.format || 'jpeg'

  // Create thumbnails that PRESERVE ASPECT RATIO
  // CSS will handle cropping with focal point via object-position
  // Using 'inside' fit means the image is scaled to fit within the bounds
  // without cropping, allowing CSS object-fit: cover to crop at the focal point

  // 1x: max 400px on longest side (supports ~200px grid cells at 2x)
  const thumbnail = await image
    .clone()
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer()

  // 2x: max 800px (only if original is large enough)
  let thumbnail2x: Buffer | undefined
  if (originalWidth >= 600 || originalHeight >= 600) {
    thumbnail2x = await image
      .clone()
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()
  }

  // 3x: max 1200px (only if original is large enough)
  let thumbnail3x: Buffer | undefined
  if (originalWidth >= 900 || originalHeight >= 900) {
    thumbnail3x = await image
      .clone()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()
  }

  // Create slideshow versions at different sizes for responsive loading
  // Medium: max 1200px (mobile slideshow at 3x density - 400px viewport × 3)
  let medium: Buffer | undefined
  if (originalWidth >= 1200 || originalHeight >= 1200) {
    medium = await image
      .clone()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer()
  }

  // Large: max 2000px (tablet/desktop)
  const large = await image
    .clone()
    .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 92 })
    .toBuffer()

  // 4K: max 4000px (only if original is large enough)
  let large4k: Buffer | undefined
  if (originalWidth >= 4000 || originalHeight >= 4000) {
    large4k = await image
      .clone()
      .resize(4000, 4000, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 92 })
      .toBuffer()
  }

  return {
    thumbnail,
    thumbnail2x,
    thumbnail3x,
    medium,
    large,
    large4k,
    width: originalWidth,
    height: originalHeight,
    fileSize: originalSize,
    format,
  }
}

/**
 * Get image dimensions without full processing
 */
export async function getImageDimensions(
  imageBuffer: Buffer
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(imageBuffer).metadata()
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
  }
}
