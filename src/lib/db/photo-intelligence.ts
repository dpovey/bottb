import { sql } from '../sql'
import type { Photo, PhotoCrop } from '../db-types'

// =============================================================================
// Photo Intelligence
// =============================================================================

/**
 * Get smart crop for a photo at a specific aspect ratio.
 * Returns the crop box calculated by the ML pipeline.
 */
export async function getPhotoCrop(
  photoId: string,
  aspectRatio: string = '4:5'
): Promise<PhotoCrop | null> {
  try {
    const { rows } = await sql<PhotoCrop>`
      SELECT *
      FROM photo_crops
      WHERE photo_id = ${photoId}::uuid
        AND aspect_ratio = ${aspectRatio}
      LIMIT 1
    `
    return rows[0] || null
  } catch (error) {
    console.error('Error fetching photo crop:', error)
    throw error
  }
}

/**
 * Get all photos for a person cluster.
 * Returns photos that belong to the specified cluster ID.
 */
export async function getPhotosByPerson(clusterId: string): Promise<Photo[]> {
  try {
    const { rows } = await sql<Photo>`
      SELECT p.*, 
             e.name as event_name, 
             b.name as band_name,
             c.name as company_name,
             b.company_slug,
             c.icon_url as company_icon_url,
             COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE p.id = ANY(
        SELECT unnest(photo_ids) FROM photo_clusters WHERE id = ${clusterId}::uuid
      )
      ORDER BY p.captured_at DESC NULLS LAST, p.uploaded_at DESC
    `
    return rows
  } catch (error) {
    console.error('Error fetching photos by person:', error)
    throw error
  }
}

/**
 * Get artist descriptions from the artist_metadata table
 * @param artistNames Array of artist names to look up
 * @returns Map of normalized artist names to their descriptions
 */
export async function getArtistDescriptions(
  artistNames: string[]
): Promise<Map<string, string>> {
  if (artistNames.length === 0) return new Map()

  // Normalize artist names for lookup
  const normalizedNames = artistNames.map((name) =>
    name.toLowerCase().trim().replace(/\s+/g, ' ')
  )

  try {
    const { rows } = await sql<{
      artist_name_normalized: string
      description: string | null
    }>`
      SELECT artist_name_normalized, description
      FROM artist_metadata
      WHERE artist_name_normalized = ANY(${normalizedNames})
        AND description IS NOT NULL
    `

    const map = new Map<string, string>()
    for (const row of rows) {
      if (row.description) {
        map.set(row.artist_name_normalized, row.description)
      }
    }
    return map
  } catch (error) {
    console.error('Error fetching artist descriptions:', error)
    return new Map()
  }
}
