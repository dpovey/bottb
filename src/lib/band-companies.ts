import type { Band, BandCompany } from './db-types'

/**
 * The list of companies a band is made up of, primary-first, for display.
 *
 * Prefers the multi-company `companies` array; falls back to the legacy single
 * `company_slug`/`company_name` fields for band shapes that predate (or don't
 * select) the array. Returns `[]` when the band has no company. See
 * doc/requirements/multi-company-bands.md.
 */
export function bandCompanyList(
  band: Pick<
    Band,
    'companies' | 'company_slug' | 'company_name' | 'company_icon_url'
  >
): BandCompany[] {
  if (band.companies && band.companies.length > 0) return band.companies
  if (band.company_slug && band.company_name) {
    return [
      {
        slug: band.company_slug,
        name: band.company_name,
        icon_url: band.company_icon_url,
      },
    ]
  }
  return []
}
