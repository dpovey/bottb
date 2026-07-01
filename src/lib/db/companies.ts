import { sql } from '../sql'
import type { Band, Company, CompanyWithStats } from '../db-types'

// ============================================================
// Company Functions
// ============================================================

/**
 * Get all companies with band and event counts.
 * Excludes companies with zero bands — keeps the underlying row, just hides
 * it from listings until at least one band is associated.
 */
export async function getCompanies(): Promise<CompanyWithStats[]> {
  const { rows } = await sql<CompanyWithStats>`
    SELECT
      c.*,
      COUNT(DISTINCT b.id) as band_count,
      COUNT(DISTINCT b.event_id) as event_count
    FROM companies c
    INNER JOIN band_companies bc ON c.slug = bc.company_slug
    INNER JOIN bands b ON b.id = bc.band_id
    GROUP BY c.slug, c.name, c.logo_url, c.icon_url, c.website, c.description, c.created_at
    ORDER BY c.name ASC
  `
  return rows
}

/**
 * Get a single company by slug
 */
export async function getCompanyBySlug(slug: string): Promise<Company | null> {
  const { rows } = await sql<Company>`
    SELECT * FROM companies WHERE slug = ${slug}
  `
  return rows[0] || null
}

/**
 * Get all bands for a company, with event info
 */
export async function getCompanyBands(
  companySlug: string
): Promise<(Band & { event_name: string; event_date: string })[]> {
  const { rows } = await sql<Band & { event_name: string; event_date: string }>`
    SELECT
      b.*,
      e.name as event_name,
      e.date as event_date,
      COALESCE((
        SELECT json_agg(json_build_object(
          'slug', c2.slug, 'name', c2.name, 'logo_url', c2.logo_url,
          'icon_url', c2.icon_url, 'is_primary', bc2.is_primary
        ) ORDER BY bc2.is_primary DESC, bc2.position, c2.name)
        FROM band_companies bc2 JOIN companies c2 ON c2.slug = bc2.company_slug
        WHERE bc2.band_id = b.id
      ), '[]'::json) as companies,
      (SELECT blob_url FROM photos WHERE band_id = b.id AND 'band_hero' = ANY(labels) LIMIT 1) as hero_thumbnail_url
    FROM bands b
    JOIN events e ON b.event_id = e.id
    JOIN band_companies bc ON bc.band_id = b.id AND bc.company_slug = ${companySlug}
    ORDER BY e.date DESC, b."order" ASC
  `
  return rows
}

/**
 * Get distinct companies from bands (for filters)
 */
export async function getDistinctCompanies(): Promise<
  { slug: string; name: string }[]
> {
  const { rows } = await sql<{ slug: string; name: string }>`
    SELECT DISTINCT c.slug, c.name
    FROM companies c
    INNER JOIN band_companies bc ON c.slug = bc.company_slug
    ORDER BY c.name ASC
  `
  return rows
}
