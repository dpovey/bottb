import sharp from 'sharp'

export interface ProcessedImage {
  thumbnail: Buffer
  thumbnail2x?: Buffer // 600px for 2x displays
  thumbnail3x?: Buffer // 900px for 3x displays
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
 * Creates responsive variants for different display densities:
 * - thumbnail: 300x300 cover crop (1x displays)
 * - thumbnail2x: 600x600 cover crop (2x/Retina displays)
 * - thumbnail3x: 900x900 cover crop (3x displays)
 * - large: max 2000px (standard displays)
 * - large4k: max 4000px (4K displays)
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

  // Create thumbnails for different display densities
  // 1x: 300x300
  const thumbnail = await image
    .clone()
    .resize(300, 300, { fit: 'cover', position: 'attention' })
    .webp({ quality: 85 })
    .toBuffer()

  // 2x: 600x600 (only if original is large enough)
  let thumbnail2x: Buffer | undefined
  if (originalWidth >= 600 || originalHeight >= 600) {
    thumbnail2x = await image
      .clone()
      .resize(600, 600, { fit: 'cover', position: 'attention' })
      .webp({ quality: 85 })
      .toBuffer()
  }

  // 3x: 900x900 (only if original is large enough)
  let thumbnail3x: Buffer | undefined
  if (originalWidth >= 900 || originalHeight >= 900) {
    thumbnail3x = await image
      .clone()
      .resize(900, 900, { fit: 'cover', position: 'attention' })
      .webp({ quality: 85 })
      .toBuffer()
  }

  // Create large versions
  // Standard: max 2000px
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
