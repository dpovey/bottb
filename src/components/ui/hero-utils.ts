import type { Photo } from '@/lib/db'

export interface HeroImage {
  blob_url: string
  thumbnail_url?: string | null
  thumbnail_2x_url?: string | null
  medium_url?: string | null
  large_4k_url?: string | null
  hero_focal_point?: { x: number; y: number }
  /** Intrinsic dimensions — used to reserve layout aspect and avoid CLS. */
  width?: number | null
  height?: number | null
}

/**
 * Helper to convert Photo[] to HeroImage[]
 * This is a pure data transformation that works in both server and client components.
 */
export function photosToHeroImages(photos: Photo[]): HeroImage[] {
  return photos.map((photo) => ({
    blob_url: photo.blob_url,
    thumbnail_url: photo.thumbnail_url,
    thumbnail_2x_url: photo.thumbnail_2x_url,
    medium_url: photo.medium_url,
    large_4k_url: photo.large_4k_url,
    hero_focal_point: photo.hero_focal_point,
    width: photo.width,
    height: photo.height,
  }))
}
