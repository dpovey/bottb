import { sql } from '../sql'
import type { Band } from '../db-types'

export async function getBandsForEvent(eventId: string) {
  const { rows } = await sql<Band>`
    SELECT b.*, 
      c.name as company_name,
      c.icon_url as company_icon_url,
      (SELECT blob_url FROM photos WHERE band_id = b.id AND 'band_hero' = ANY(labels) LIMIT 1) as hero_thumbnail_url,
      (SELECT hero_focal_point FROM photos WHERE band_id = b.id AND 'band_hero' = ANY(labels) LIMIT 1) as hero_focal_point
    FROM bands b 
    LEFT JOIN companies c ON b.company_slug = c.slug
    WHERE b.event_id = ${eventId} 
    ORDER BY b."order"
  `
  return rows
}

/**
 * Get all bands across all events
 */
export async function getBands(): Promise<Band[]> {
  const { rows } = await sql<Band>`
    SELECT b.*, 
      c.name as company_name,
      c.icon_url as company_icon_url
    FROM bands b 
    LEFT JOIN companies c ON b.company_slug = c.slug
    ORDER BY b.event_id, b."order"
  `
  return rows
}

export async function getBandById(bandId: string): Promise<Band | null> {
  const { rows } = await sql<Band>`
    SELECT b.*, 
      c.name as company_name,
      c.icon_url as company_icon_url
    FROM bands b 
    LEFT JOIN companies c ON b.company_slug = c.slug
    WHERE b.id = ${bandId}
  `
  return rows[0] || null
}
