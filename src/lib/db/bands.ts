import { sql, sqlQuery } from '../sql'
import type { Band } from '../db-types'

/**
 * Replace the set of companies a band is made up of (multi-company bands).
 *
 * Rewrites the band's `band_companies` rows to exactly `companySlugs`
 * (deduped), marks `primarySlug` (or the first slug) as primary, and keeps the
 * denormalised `bands.company_slug` in sync with that primary. Passing an empty
 * list clears all associations and nulls `company_slug`.
 *
 * Callers should validate that the slugs exist first (the FK will otherwise
 * reject the insert). See doc/requirements/multi-company-bands.md.
 */
export async function setBandCompanies(
  bandId: string,
  companySlugs: string[],
  primarySlug?: string | null
): Promise<void> {
  const slugs = [...new Set(companySlugs.filter(Boolean))]
  const primary =
    primarySlug && slugs.includes(primarySlug) ? primarySlug : slugs[0]
  const ordered = primary
    ? [primary, ...slugs.filter((s) => s !== primary)]
    : slugs

  await sql`DELETE FROM band_companies WHERE band_id = ${bandId}`
  for (let position = 0; position < ordered.length; position++) {
    const slug = ordered[position]
    await sql`
      INSERT INTO band_companies (band_id, company_slug, is_primary, position)
      VALUES (${bandId}, ${slug}, ${slug === primary}, ${position})
    `
  }
  await sql`UPDATE bands SET company_slug = ${primary ?? null} WHERE id = ${bandId}`
}

/**
 * Return the subset of `slugs` that do not exist in `companies` (for validation
 * before writing band_companies).
 */
export async function findMissingCompanySlugs(
  slugs: string[]
): Promise<string[]> {
  const unique = [...new Set(slugs.filter(Boolean))]
  if (unique.length === 0) return []
  // Array param via sqlQuery — @vercel/postgres' tagged template only accepts
  // primitive params, so ANY($1) with a text[] must go through db.query.
  const { rows } = await sqlQuery<{ slug: string }>(
    'SELECT slug FROM companies WHERE slug = ANY($1)',
    [unique]
  )
  const found = new Set(rows.map((r) => r.slug))
  return unique.filter((s) => !found.has(s))
}

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
