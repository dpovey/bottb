import { sql } from '../sql'
import type { Band } from '../db-types'

export async function getBandsForEvent(eventId: string) {
  const { rows } = await sql<Band>`
    SELECT b.*,
      c.name as company_name,
      c.icon_url as company_icon_url,
      c.logo_url as company_logo_url,
      COALESCE((
        SELECT json_agg(json_build_object(
          'slug', c2.slug, 'name', c2.name, 'logo_url', c2.logo_url,
          'icon_url', c2.icon_url, 'is_primary', bc.is_primary
        ) ORDER BY bc.is_primary DESC, bc.position, c2.name)
        FROM band_companies bc JOIN companies c2 ON c2.slug = bc.company_slug
        WHERE bc.band_id = b.id
      ), '[]'::json) as companies,
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
      c.icon_url as company_icon_url,
      COALESCE((
        SELECT json_agg(json_build_object(
          'slug', c2.slug, 'name', c2.name, 'logo_url', c2.logo_url,
          'icon_url', c2.icon_url, 'is_primary', bc.is_primary
        ) ORDER BY bc.is_primary DESC, bc.position, c2.name)
        FROM band_companies bc JOIN companies c2 ON c2.slug = bc.company_slug
        WHERE bc.band_id = b.id
      ), '[]'::json) as companies
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
      c.icon_url as company_icon_url,
      COALESCE((
        SELECT json_agg(json_build_object(
          'slug', c2.slug, 'name', c2.name, 'logo_url', c2.logo_url,
          'icon_url', c2.icon_url, 'is_primary', bc.is_primary
        ) ORDER BY bc.is_primary DESC, bc.position, c2.name)
        FROM band_companies bc JOIN companies c2 ON c2.slug = bc.company_slug
        WHERE bc.band_id = b.id
      ), '[]'::json) as companies
    FROM bands b
    LEFT JOIN companies c ON b.company_slug = c.slug
    WHERE b.id = ${bandId}
  `
  return rows[0] || null
}
