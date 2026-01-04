/**
 * Shared utilities for building responsive image srcsets for photos.
 *
 * Photo variants available:
 * - thumbnail_url: 400px WebP (1x displays)
 * - thumbnail_2x_url: 800px WebP (2x/Retina displays)
 * - medium_url: 1200px WebP (3x thumbnails + mobile slideshows)
 * - blob_url: 2000px WebP (desktop slideshows)
 * - large_4k_url: 4000px WebP (4K displays)
 *
 * Note: thumbnail_3x_url is deprecated but kept for backward compatibility
 * with existing photos. New uploads use medium_url for 3x.
 */

import type { Photo } from './db-types'

/**
 * Photo-like object with optional image URLs for srcset building.
 * Allows use with partial photo data (e.g., hero photos).
 */
export interface PhotoImageUrls {
  thumbnail_url?: string | null
  thumbnail_2x_url?: string | null
  thumbnail_3x_url?: string | null
  medium_url?: string | null
  blob_url: string
  large_4k_url?: string | null
}

/**
 * Build srcSet for responsive thumbnails (1x: 400px, 2x: 800px, 3x: 1200px).
 * Uses medium_url for 3x (falls back to deprecated thumbnail_3x_url for old photos).
 * Returns undefined if only one source is available (no benefit from srcset).
 */
export function buildThumbnailSrcSet(
  photo: Pick<
    Photo,
    'thumbnail_url' | 'thumbnail_2x_url' | 'thumbnail_3x_url' | 'medium_url'
  >
): string | undefined {
  const sources: string[] = []

  if (photo.thumbnail_url) {
    sources.push(`${photo.thumbnail_url} 400w`)
  }
  if (photo.thumbnail_2x_url) {
    sources.push(`${photo.thumbnail_2x_url} 800w`)
  }
  // Use medium_url for 3x, fall back to deprecated thumbnail_3x_url
  const url3x = photo.medium_url || photo.thumbnail_3x_url
  if (url3x) {
    sources.push(`${url3x} 1200w`)
  }

  return sources.length > 1 ? sources.join(', ') : undefined
}

/**
 * Get best available thumbnail source (prefer highest resolution).
 * Falls back through medium → 2x → 1x → blob_url.
 * Includes deprecated thumbnail_3x_url for backward compatibility.
 */
export function getBestThumbnailSrc(
  photo: Pick<
    Photo,
    | 'thumbnail_url'
    | 'thumbnail_2x_url'
    | 'thumbnail_3x_url'
    | 'medium_url'
    | 'blob_url'
  >
): string {
  return (
    photo.medium_url ||
    photo.thumbnail_3x_url || // backward compatibility
    photo.thumbnail_2x_url ||
    photo.thumbnail_url ||
    photo.blob_url
  )
}

/**
 * Build srcSet for full-size slideshow/hero images.
 * Uses medium (1200w) for mobile, blob_url (2000w) for tablet, 4K (4000w) for desktop.
 */
export function buildHeroSrcSet(photo: PhotoImageUrls): string {
  const sources: string[] = []

  // Medium variant (1200px) - perfect for mobile at 3x density
  if (photo.medium_url) {
    sources.push(`${photo.medium_url} 1200w`)
  }

  // Large variant (2000px) - default, always available
  sources.push(`${photo.blob_url} 2000w`)

  // 4K variant (4000px) - for high-res displays
  if (photo.large_4k_url) {
    sources.push(`${photo.large_4k_url} 4000w`)
  }

  return sources.join(', ')
}

/**
 * Get best available hero source for a given display context.
 *
 * PERFORMANCE NOTE: We intentionally use blob_url (2000px) as the default
 * for desktop instead of large_4k_url (4000px). The 4K variant is 2.3MB vs
 * ~500KB for the 2000px version. Let srcSet handle upgrading to 4K only
 * when truly needed (actual 4K displays with sizes > 2000px).
 *
 * - 'desktop': blob_url (2000px - sufficient for most displays at 2x DPR)
 * - 'mobile': prefer medium_url (1200px) → blob_url
 * - '4k': explicitly request 4K (for true 4K displays)
 * - 'default': blob_url
 */
export function getBestHeroSrc(
  photo: PhotoImageUrls,
  context: 'desktop' | 'mobile' | '4k' | 'default' = 'default'
): string {
  switch (context) {
    case '4k':
      // Only use 4K when explicitly requested (true 4K displays)
      return photo.large_4k_url || photo.blob_url
    case 'desktop':
      // Use 2000px for desktop - sufficient for 1920px displays at 2x DPR
      // srcSet will upgrade to 4K if sizes indicates need for larger
      return photo.blob_url
    case 'mobile':
      return photo.medium_url || photo.blob_url
    default:
      return photo.blob_url
  }
}
