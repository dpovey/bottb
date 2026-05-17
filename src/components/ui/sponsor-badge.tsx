import Link from 'next/link'

export interface SponsorBadgeProps {
  /** Sponsor display name (used for alt text) */
  name: string
  /** URL to the sponsor's logo image */
  logoUrl: string
  /** Link the badge wraps. Defaults to /sponsors */
  link?: string
  /** Tagline shown above the logo. Defaults to "Powered by" */
  label?: string
  /** Open link in a new tab (use for external sponsor sites) */
  external?: boolean
}

/**
 * Displays a "Powered by <sponsor>" badge as a full-width section.
 * Used on the homepage and event pages to surface the National Partner.
 */
export function SponsorBadge({
  name,
  logoUrl,
  link = '/sponsors',
  label = 'Powered by',
  external = false,
}: SponsorBadgeProps) {
  const externalProps = external
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {}

  return (
    <section className="py-10 bg-bg border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <Link
          href={link}
          {...externalProps}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 group"
        >
          <span className="text-xs tracking-[0.3em] uppercase text-text-dim">
            {label}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={name}
            className="h-8 sm:h-10 w-auto opacity-70 group-hover:opacity-100 transition-opacity"
          />
        </Link>
      </div>
    </section>
  )
}
