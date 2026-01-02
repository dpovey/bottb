/**
 * Shared utilities for building responsive image srcsets for photos.
 *
 * Photo variants available:
 * - thumbnail_url: 300×300 WebP (1x)
 * - thumbnail_2x_url: 600×600 WebP (2x)
 * - thumbnail_3x_url: 900×900 WebP (3x)
 * - medium_url: 1200px WebP (mobile/tablet)
 * - blob_url: 2000px WebP (desktop)
 * - large_4k_url: 4000px WebP (4K displays)
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
 * Build srcSet for responsive thumbnails (1x: 300px, 2x: 600px, 3x: 900px).
 * Returns undefined if only one source is available (no benefit from srcset).
 */
export function buildThumbnailSrcSet(
  photo: Pick<Photo, 'thumbnail_url' | 'thumbnail_2x_url' | 'thumbnail_3x_url'>
): string | undefined {
  const sources: string[] = []

  if (photo.thumbnail_url) {
    sources.push(`${photo.thumbnail_url} 300w`)
  }
  if (photo.thumbnail_2x_url) {
    sources.push(`${photo.thumbnail_2x_url} 600w`)
  }
  if (photo.thumbnail_3x_url) {
    sources.push(`${photo.thumbnail_3x_url} 900w`)
  }

  return sources.length > 1 ? sources.join(', ') : undefined
}

/**
 * Get best available thumbnail source (prefer highest resolution).
 * Falls back through 3x → 2x → 1x → blob_url.
 */
export function getBestThumbnailSrc(
  photo: Pick<
    Photo,
    'thumbnail_url' | 'thumbnail_2x_url' | 'thumbnail_3x_url' | 'blob_url'
  >
): string {
  return (
    photo.thumbnail_3x_url ||
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
 * - 'desktop': prefer 4K → blob_url
 * - 'mobile': prefer medium_url → blob_url
 * - 'default': blob_url
 */
export function getBestHeroSrc(
  photo: PhotoImageUrls,
  context: 'desktop' | 'mobile' | 'default' = 'default'
): string {
  switch (context) {
    case 'desktop':
      return photo.large_4k_url || photo.blob_url
    case 'mobile':
      return photo.medium_url || photo.blob_url
    default:
      return photo.blob_url
  }
}

