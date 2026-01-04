import type { Photo } from '@/lib/db'

export interface HeroImage {
  blob_url: string
  large_4k_url?: string | null
  hero_focal_point?: { x: number; y: number }
}

/**
 * Helper to convert Photo[] to HeroImage[]
 * This is a pure data transformation that works in both server and client components.
 */
export function photosToHeroImages(photos: Photo[]): HeroImage[] {
  return photos.map((photo) => ({
    blob_url: photo.blob_url,
    large_4k_url: photo.large_4k_url,
    hero_focal_point: photo.hero_focal_point,
  }))
}
