import { sql } from '../sql'
import type { Band, Company, CompanyWithStats } from '../db-types'

// ============================================================
// Company Functions
// ============================================================

/**
 * Get all companies with band and event counts
 */
export async function getCompanies(): Promise<CompanyWithStats[]> {
  const { rows } = await sql<CompanyWithStats>`
    SELECT 
      c.*,
      COUNT(DISTINCT b.id) as band_count,
      COUNT(DISTINCT b.event_id) as event_count
    FROM companies c
    LEFT JOIN bands b ON c.slug = b.company_slug
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
      (SELECT blob_url FROM photos WHERE band_id = b.id AND 'band_hero' = ANY(labels) LIMIT 1) as hero_thumbnail_url
    FROM bands b
    JOIN events e ON b.event_id = e.id
    WHERE b.company_slug = ${companySlug}
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
    INNER JOIN bands b ON c.slug = b.company_slug
    ORDER BY c.name ASC
  `
  return rows
}
