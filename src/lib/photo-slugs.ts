/**
 * Photo slug generation and lookup utilities
 *
 * Provides SEO-friendly URL slugs for photos following this hierarchy:
 * 1. band + event: {band-slug}-{event-slug}-{n}
 * 2. event only:   {event-slug}-{n}
 * 3. band only:    {band-slug}-{n}
 * 4. photographer: {photographer-slug}-{n}
 * 5. fallback:     photo-{n}
 *
 * Slugs are immutable once generated - retagging a photo does NOT change its slug.
 */

import { sql } from './sql'
import { slugify } from './utils'
import type { Photo } from './db-types'

/**
 * Information needed to generate a photo slug
 */
interface PhotoSlugContext {
  id: string
  band_id: string | null
  band_name?: string | null
  event_id: string | null
  event_name?: string | null
  photographer: string | null
}

/**
 * Get the next sequence number for a given slug prefix
 */
export async function getNextSequenceForPrefix(
  prefix: string
): Promise<number> {
  const { rows } = await sql<{ max_seq: number | null }>`
    SELECT MAX(
      CAST(
        SUBSTRING(slug FROM LENGTH(${prefix}) + 2) AS INTEGER
      )
    ) as max_seq
    FROM photos
    WHERE slug_prefix = ${prefix}
  `
  return (rows[0]?.max_seq || 0) + 1
}

/**
 * Build the slug prefix based on photo attribution
 * Returns the prefix and a description of what type it is
 */
function buildSlugPrefix(photo: PhotoSlugContext): {
  prefix: string
  type: 'band-event' | 'event' | 'band' | 'photographer' | 'fallback'
} {
  // Priority 1: Band + Event (most SEO value)
  if (photo.band_name && photo.event_name) {
    const bandSlug = slugify(photo.band_name)
    const eventSlug = slugify(photo.event_name)
    return { prefix: `${bandSlug}-${eventSlug}`, type: 'band-event' }
  }

  // Priority 2: Event only
  if (photo.event_name) {
    return { prefix: slugify(photo.event_name), type: 'event' }
  }

  // Priority 3: Band only (rare - bands usually have events)
  if (photo.band_name) {
    return { prefix: slugify(photo.band_name), type: 'band' }
  }

  // Priority 4: Photographer
  if (photo.photographer) {
    return { prefix: slugify(photo.photographer), type: 'photographer' }
  }

  // Priority 5: Fallback
  return { prefix: 'photo', type: 'fallback' }
}

/**
 * Generate a unique slug for a photo based on its current attribution
 *
 * @param photo - Photo with band_name and event_name populated
 * @returns The generated slug and prefix
 */
export async function generatePhotoSlug(
  photo: PhotoSlugContext
): Promise<{ slug: string; prefix: string }> {
  const { prefix } = buildSlugPrefix(photo)
  const sequence = await getNextSequenceForPrefix(prefix)
  const slug = `${prefix}-${sequence}`

  return { slug, prefix }
}

/**
 * Generate slug for a photo and save it to the database
 */
export async function generateAndSavePhotoSlug(
  photoId: string
): Promise<{ slug: string; prefix: string } | null> {
  // First, fetch the photo with band and event names
  const { rows: photos } = await sql<PhotoSlugContext>`
    SELECT p.id, p.band_id, p.event_id, p.photographer,
           b.name as band_name, e.name as event_name
    FROM photos p
    LEFT JOIN bands b ON p.band_id = b.id
    LEFT JOIN events e ON p.event_id = e.id
    WHERE p.id = ${photoId}
  `

  const photo = photos[0]
  if (!photo) {
    return null
  }

  // Generate the slug
  const { slug, prefix } = await generatePhotoSlug(photo)

  // Save to database
  await sql`
    UPDATE photos
    SET slug = ${slug}, slug_prefix = ${prefix}
    WHERE id = ${photoId}
  `

  return { slug, prefix }
}

/**
 * Get a photo by its SEO-friendly slug
 */
export async function getPhotoBySlug(slug: string): Promise<Photo | null> {
  try {
    const { rows } = await sql<Photo>`
      SELECT p.*, e.name as event_name, b.name as band_name, 
             c.name as company_name, b.company_slug as company_slug, 
             c.icon_url as company_icon_url,
             COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url,
             p.xmp_metadata->>'thumbnail_2x_url' as thumbnail_2x_url,
             p.xmp_metadata->>'thumbnail_3x_url' as thumbnail_3x_url,
             p.xmp_metadata->>'medium_url' as medium_url,
             p.xmp_metadata->>'large_4k_url' as large_4k_url
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE p.slug = ${slug}
    `
    return rows[0] || null
  } catch (error) {
    console.error('Error fetching photo by slug:', error)
    throw error
  }
}

/**
 * Get a photo by either slug or UUID
 * Useful for routes that need to support both formats during migration
 */
export async function getPhotoBySlugOrId(
  slugOrId: string
): Promise<Photo | null> {
  // UUID format: 8-4-4-4-12 hex characters
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      slugOrId
    )

  if (isUuid) {
    // Import dynamically to avoid circular dependency
    const { getPhotoById } = await import('./db')
    return getPhotoById(slugOrId)
  }

  return getPhotoBySlug(slugOrId)
}

/**
 * Check if a string looks like a UUID
 */
export function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str
  )
}

/**
 * Get the slug for a photo, generating one if it doesn't exist
 * Used during the transition period while backfilling
 */
export async function ensurePhotoSlug(photoId: string): Promise<string | null> {
  // Check if slug already exists
  const { rows } = await sql<{ slug: string | null }>`
    SELECT slug FROM photos WHERE id = ${photoId}
  `

  if (rows[0]?.slug) {
    return rows[0].slug
  }

  // Generate and save a new slug
  const result = await generateAndSavePhotoSlug(photoId)
  return result?.slug || null
}

/**
 * Batch generate slugs for photos that don't have them
 * Processes in order of uploaded_at to maintain consistent sequencing
 *
 * @param limit - Maximum number of photos to process (default: 100)
 * @returns Number of photos processed
 */
export async function backfillPhotoSlugs(limit = 100): Promise<{
  processed: number
  errors: string[]
}> {
  // Get photos without slugs, ordered by upload date for consistent sequencing
  const { rows: photos } = await sql<PhotoSlugContext>`
    SELECT p.id, p.band_id, p.event_id, p.photographer,
           b.name as band_name, e.name as event_name
    FROM photos p
    LEFT JOIN bands b ON p.band_id = b.id
    LEFT JOIN events e ON p.event_id = e.id
    WHERE p.slug IS NULL
    ORDER BY p.uploaded_at ASC
    LIMIT ${limit}
  `

  let processed = 0
  const errors: string[] = []

  for (const photo of photos) {
    try {
      const { slug, prefix } = await generatePhotoSlug(photo)

      await sql`
        UPDATE photos
        SET slug = ${slug}, slug_prefix = ${prefix}
        WHERE id = ${photo.id}
      `

      processed++
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`Photo ${photo.id}: ${message}`)
    }
  }

  return { processed, errors }
}

/**
 * Get count of photos without slugs (for backfill progress tracking)
 */
export async function getPhotosWithoutSlugCount(): Promise<number> {
  const { rows } = await sql<{ count: string }>`
    SELECT COUNT(*) as count FROM photos WHERE slug IS NULL
  `
  return parseInt(rows[0]?.count || '0', 10)
}
