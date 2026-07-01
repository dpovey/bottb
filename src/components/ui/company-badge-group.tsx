import { cn } from '@/lib/utils'
import type { BandCompany } from '@/lib/db-types'
import { CompanyBadge, type CompanyBadgeProps } from './company-badge'

export interface CompanyBadgeGroupProps {
  /**
   * The companies a band is made up of, primary-first. Renders one
   * {@link CompanyBadge} each (e.g. "Rex Software" + "UrbanX"). Bands currently
   * have at most two companies, so no overflow/"+N more" handling is needed yet.
   */
  companies: BandCompany[]
  variant?: CompanyBadgeProps['variant']
  size?: CompanyBadgeProps['size']
  asLink?: CompanyBadgeProps['asLink']
  /** Applied to the wrapping flex container. */
  className?: string
}

/**
 * Renders every company a band belongs to as a row of badges. Use this instead
 * of a single {@link CompanyBadge} wherever a band's company affiliation is
 * shown, so multi-company bands (e.g. The ShipReX = Rex Software + UrbanX)
 * display all of their companies. Renders nothing when the list is empty.
 */
export function CompanyBadgeGroup({
  companies,
  variant = 'default',
  size = 'md',
  asLink = true,
  className,
}: CompanyBadgeGroupProps) {
  if (!companies || companies.length === 0) return null

  return (
    <div
      className={cn('inline-flex flex-wrap items-center gap-1.5', className)}
    >
      {companies.map((company) => (
        <CompanyBadge
          key={company.slug}
          slug={company.slug}
          name={company.name}
          iconUrl={company.icon_url}
          variant={variant}
          size={size}
          asLink={asLink}
        />
      ))}
    </div>
  )
}
