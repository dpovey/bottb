import { sql } from '../sql'
import type { Photo, PhotographerWithStats } from '../db-types'

// ============================================================
// Photographer Functions
// ============================================================

/**
 * Get all photographers with photo counts
 */
export async function getPhotographers(): Promise<PhotographerWithStats[]> {
  const { rows } = await sql<PhotographerWithStats>`
    SELECT 
      p.*,
      COALESCE(pc.photo_count, 0)::int as photo_count
    FROM photographers p
    LEFT JOIN (
      SELECT photographer as name, COUNT(*)::int as photo_count
      FROM photos
      WHERE photographer IS NOT NULL
      GROUP BY photographer
    ) pc ON p.name = pc.name
    ORDER BY p.name ASC
  `
  return rows
}

/**
 * Get a single photographer by slug
 */
export async function getPhotographerBySlug(
  slug: string
): Promise<PhotographerWithStats | null> {
  const { rows } = await sql<PhotographerWithStats>`
    SELECT 
      p.*,
      COALESCE(pc.photo_count, 0)::int as photo_count
    FROM photographers p
    LEFT JOIN (
      SELECT photographer as name, COUNT(*)::int as photo_count
      FROM photos
      WHERE photographer IS NOT NULL
      GROUP BY photographer
    ) pc ON p.name = pc.name
    WHERE p.slug = ${slug}
  `
  return rows[0] || null
}

/**
 * Get hero photo for a photographer (by name match and label)
 */
export async function getPhotographerHeroPhoto(
  photographerName: string
): Promise<Photo | null> {
  const { rows } = await sql<Photo>`
    SELECT p.*, e.name as event_name, b.name as band_name,
           COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
    FROM photos p
    LEFT JOIN events e ON p.event_id = e.id
    LEFT JOIN bands b ON p.band_id = b.id
    WHERE p.photographer = ${photographerName}
      AND 'photographer_hero' = ANY(p.labels)
    ORDER BY p.uploaded_at DESC
    LIMIT 1
  `
  return rows[0] || null
}

/**
 * Get a random photo from a photographer (fallback for hero)
 */
export async function getPhotographerRandomPhoto(
  photographerName: string
): Promise<Photo | null> {
  const { rows } = await sql<Photo>`
    SELECT p.*, e.name as event_name, b.name as band_name,
           COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
    FROM photos p
    LEFT JOIN events e ON p.event_id = e.id
    LEFT JOIN bands b ON p.band_id = b.id
    WHERE p.photographer = ${photographerName}
    ORDER BY RANDOM()
    LIMIT 1
  `
  return rows[0] || null
}
