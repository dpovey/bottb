import Link from 'next/link'
import Image from 'next/image'
import { logoSizes, logoIntrinsicWidths } from '@/lib/logo-utils'

export interface EventCompanyStripBand {
  company_slug?: string
  company_name?: string
  company_logo_url?: string
  company_icon_url?: string
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
 * Static row of greyed-out company logos for the bands competing in an event.
 * Logos animate to full colour on hover. Falls back to the square company icon
 * when a wide logo is not available. Renders nothing when no companies have a
 * usable logo (e.g. no bands assigned yet).
 */
export function EventCompanyStrip({ bands }: EventCompanyStripProps) {
  const seen = new Set<string>()
  const companies: CompanyDisplay[] = []
  for (const band of bands) {
    if (!band.company_slug || !band.company_name) continue
    if (seen.has(band.company_slug)) continue
    const logoUrl = band.company_logo_url || band.company_icon_url
    if (!logoUrl) continue
    seen.add(band.company_slug)
    companies.push({
      slug: band.company_slug,
      name: band.company_name,
      logoUrl,
    })
  }

  if (companies.length === 0) return null

  return (
    <section
      aria-label="Participating companies"
      className="py-6 bg-bg border-b border-white/5"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 sm:gap-x-16 md:gap-x-20 lg:gap-x-24">
          {companies.map((company) => (
            <Link
              key={company.slug}
              href={`/companies/${company.slug}`}
              className="group relative shrink-0"
            >
              <div className="flex h-8 items-center justify-center sm:h-10">
                <Image
                  src={company.logoUrl}
                  alt={`${company.name} logo`}
                  width={logoIntrinsicWidths.marquee.width}
                  height={logoIntrinsicWidths.marquee.height}
                  className="h-full w-auto max-w-[140px] object-contain opacity-40 grayscale transition-all duration-200 group-hover:opacity-100 group-hover:grayscale-0"
                  loading="lazy"
                  sizes={logoSizes.marquee}
                />
              </div>
              <span className="absolute top-full left-1/2 mt-2 -translate-x-1/2 whitespace-nowrap rounded-sm border border-white/10 bg-bg-elevated px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                {company.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
