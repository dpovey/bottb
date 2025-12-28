/**
 * Curated Unsplash images for consistent visual presentation.
 *
 * These are fixed image IDs (not random) to ensure:
 * 1. Visual regression tests are stable
 * 2. Consistent branding across the app
 * 3. Rock concert/music energy aesthetic
 *
 * All images are from Unsplash with appropriate licenses for web use.
 */

export interface StockImage {
  id: string
  url: string
  /** Suggested focal point for cropping (percentage from top-left) */
  focalPoint?: { x: number; y: number }
  description: string
}

/**
 * Concert and live music images with high energy.
 * Use these for heroes, event cards, and backgrounds.
 */
export const CONCERT_IMAGES: StockImage[] = [
  {
    id: 'concert-crowd-lights',
    url: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1920&q=80',
    focalPoint: { x: 50, y: 40 },
    description: 'Concert crowd with dramatic stage lights',
  },
  {
    id: 'stage-performance',
    url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1920&q=80',
    focalPoint: { x: 50, y: 50 },
    description: 'Band performing on stage with blue lighting',
  },
  {
    id: 'crowd-energy',
    url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1920&q=80',
    focalPoint: { x: 50, y: 60 },
    description: 'Energetic crowd at live concert',
  },
  {
    id: 'hands-up',
    url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1920&q=80',
    focalPoint: { x: 50, y: 50 },
    description: 'Crowd with hands raised at concert',
  },
  {
    id: 'live-performance',
    url: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1920&q=80',
    focalPoint: { x: 50, y: 45 },
    description: 'Live music performance with dramatic lighting',
  },
  {
    id: 'concert-atmosphere',
    url: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1920&q=80',
    focalPoint: { x: 50, y: 55 },
    description: 'Concert atmosphere with colorful lights',
  },
  {
    id: 'band-stage',
    url: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1920&q=80',
    focalPoint: { x: 50, y: 40 },
    description: 'Band performing on illuminated stage',
  },
  {
    id: 'concert-lights',
    url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1920&q=80',
    focalPoint: { x: 50, y: 50 },
    description: 'Concert lights and crowd silhouettes',
  },
]

/**
 * Default hero image - used as fallback when no event photos available.
 * This is a specific, deterministic image (not random).
 */
export const DEFAULT_HERO_IMAGE = CONCERT_IMAGES[0]

/**
 * Get a specific stock image by index (deterministic).
 * Use this in stories and tests for consistent visuals.
 */
export function getStockImage(index: number): StockImage {
  return CONCERT_IMAGES[index % CONCERT_IMAGES.length]
}

/**
 * Get stock image URL by index.
 */
export function getStockImageUrl(index: number): string {
  return getStockImage(index).url
}

/**
 * Get all concert images (for carousels).
 */
export function getAllConcertImages(): StockImage[] {
  return CONCERT_IMAGES
}

/**
 * Thumbnail-sized versions for faster loading in grids.
 */
export function getThumbnailUrl(image: StockImage, width = 400): string {
  // Replace w=1920 with requested width
  return image.url.replace('w=1920', `w=${width}`)
}
