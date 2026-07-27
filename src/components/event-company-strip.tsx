import Link from 'next/link'
import Image from 'next/image'
import { logoSizes, logoIntrinsicWidths } from '@/lib/logo-utils'
import type { BandCompany } from '@/lib/db-types'

export interface EventCompanyStripBand {
  company_slug?: string
  company_name?: string
  company_logo_url?: string
  company_icon_url?: string
  /** All companies the band is made up of (multi-company bands). */
  companies?: BandCompany[]
}

export interface EventCompanyStripProps {
  /** Bands competing in the event — each band contributes its company logo. */
  bands: EventCompanyStripBand[]
}

interface CompanyDisplay {
  slug: string
  name: string
  logoUrl: string
}

/**
 * Static row of company logos for the bands competing in an event. Logos are
 * muted at rest and brighten on hover (see `.logo-muted` in globals.css).
 * Falls back to the square company icon when a wide logo is not available.
 * Renders nothing when no companies have a usable logo (e.g. no bands
 * assigned yet).
 */
export function EventCompanyStrip({ bands }: EventCompanyStripProps) {
  const seen = new Set<string>()
  const companies: CompanyDisplay[] = []
  for (const band of bands) {
    // Each company the band is made up of contributes its logo. Prefer the
    // multi-company array; fall back to the legacy single-company fields.
    const bandCompanies: BandCompany[] =
      band.companies && band.companies.length > 0
        ? band.companies
        : band.company_slug && band.company_name
          ? [
              {
                slug: band.company_slug,
                name: band.company_name,
                logo_url: band.company_logo_url,
                icon_url: band.company_icon_url,
              },
            ]
          : []
    for (const company of bandCompanies) {
      if (seen.has(company.slug)) continue
      const logoUrl = company.logo_url || company.icon_url
      if (!logoUrl) continue
      seen.add(company.slug)
      companies.push({
        slug: company.slug,
        name: company.name,
        logoUrl,
      })
    }
  }

  if (companies.length === 0) return null

  return (
    <section
      aria-label="Participating companies"
      className="py-6 bg-bg border-b border-white/5"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center">
          {companies.map((company) => (
            <Link
              key={company.slug}
              href={`/companies/${company.slug}`}
              className="group shrink-0 px-6 py-3 sm:px-8 sm:py-4 md:px-10 lg:px-12 lg:py-5"
            >
              <div className="flex h-10 items-center justify-center sm:h-12 lg:h-14">
                <Image
                  src={company.logoUrl}
                  alt={`${company.name} logo`}
                  width={logoIntrinsicWidths.marquee.width}
                  height={logoIntrinsicWidths.marquee.height}
                  className="logo-muted h-full w-auto object-contain"
                  loading="lazy"
                  sizes={logoSizes.marquee}
                />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
