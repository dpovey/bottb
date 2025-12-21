'use client'

import { trackSocialLinkClick } from '@/lib/analytics'

export interface SocialIconLinkProps {
  href: string
  platform: string
  label: string
  location: string // Where the icon appears (e.g., "footer", "about_hero", "band_page")
  children: React.ReactNode
  className?: string
}

/**
 * Tracked social icon link component
 * Tracks clicks with platform and location information
 */
export function SocialIconLink({
  href,
  platform,
  label,
  location,
  children,
  className,
}: SocialIconLinkProps) {
  const handleClick = () => {
    trackSocialLinkClick({
      platform,
      location,
      url: href,
    })
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      onClick={handleClick}
      className={className}
    >
      {children}
    </a>
  )
}
