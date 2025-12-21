import Link from 'next/link'
import Image from 'next/image'
import { getCompanies, CompanyWithStats } from '@/lib/db'
import { Button } from '@/components/ui'
import { ChevronRightIcon } from '@/components/icons'

interface CompanyWithLogo extends CompanyWithStats {
  logo_url: string
}

interface CompanyLogoMarqueeProps {
  /** Custom title for the section */
  title?: string
  /** Custom subtitle */
  subtitle?: string
  /** Whether to show the "View All Companies" button */
  showViewAll?: boolean
  /** Custom class for the section */
  className?: string
}

/**
 * Infinite scrolling marquee of company logos
 * - Logos are grayscale by default, full color on hover
 * - Animation pauses on hover
 * - Respects prefers-reduced-motion
 * - Clicking a logo navigates to the company page
 */
export async function CompanyLogoMarquee({
  title = "Companies Who've Competed",
  subtitle = 'Tech companies bringing the rock since 2022',
  showViewAll = true,
  className = '',
}: CompanyLogoMarqueeProps) {
  // Fetch companies with logos
  const allCompanies = await getCompanies()

  // Filter to only companies with logos
  const companiesWithLogos = allCompanies.filter(
    (c): c is CompanyWithLogo => !!c.logo_url
  )

  // Don't render if no companies have logos
  if (companiesWithLogos.length === 0) {
    return null
  }

  // Duplicate logos to ensure seamless loop
  // If few logos, duplicate multiple times to fill the viewport
  const minLogosForLoop = 8
  let displayLogos = [...companiesWithLogos]
  while (displayLogos.length < minLogosForLoop) {
    displayLogos = [...displayLogos, ...companiesWithLogos]
  }

  return (
    <section className={`py-16 bg-bg border-t border-white/5 ${className}`}>
      {/* Section Header */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-sm tracking-widest uppercase text-accent mb-2">
            {title}
          </h2>
          {subtitle && <p className="text-text-muted text-sm">{subtitle}</p>}
        </div>
      </div>

      {/* Full-width marquee container with faded edges */}
      <div className="marquee-container overflow-hidden">
        <div
          className="marquee-track flex items-center gap-16 py-4"
          style={{ width: 'max-content' }}
        >
          {/* First set of logos */}
          {displayLogos.map((company, index) => (
            <LogoItem key={`${company.slug}-${index}`} company={company} />
          ))}

          {/* Duplicate set for seamless loop */}
          {displayLogos.map((company, index) => (
            <LogoItem key={`${company.slug}-dup-${index}`} company={company} />
          ))}
        </div>
      </div>

      {/* View All Link */}
      {showViewAll && (
        <div className="max-w-7xl mx-auto px-6 lg:px-8 mt-8 text-center">
          <Link href="/companies">
            <Button variant="outline-solid" size="sm">
              View All Companies
              <ChevronRightIcon className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      )}
    </section>
  )
}

/**
 * Individual logo item with hover effects and tooltip
 * Uses Next.js Image with proper dimensions to prevent layout shifts
 */
function LogoItem({ company }: { company: CompanyWithLogo }) {
  return (
    <Link
      href={`/companies?company=${company.slug}`}
      className="logo-wrapper relative shrink-0 group"
    >
      <div className="logo-item h-12 w-auto flex items-center justify-center px-4">
        <Image
          src={company.logo_url}
          alt={`${company.name} logo`}
          width={180}
          height={48}
          className="h-full w-auto object-contain max-w-[180px]"
          loading="lazy"
          unoptimized
          sizes="(max-width: 768px) 120px, 180px"
        />
      </div>

      {/* Tooltip with company name */}
      <span className="logo-tooltip absolute top-full left-1/2 mt-3 px-3 py-1.5 bg-bg-elevated border border-white/10 rounded-sm text-xs text-white whitespace-nowrap z-10">
        {company.name}
      </span>
    </Link>
  )
}
