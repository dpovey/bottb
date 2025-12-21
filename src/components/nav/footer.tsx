import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { socialLinks } from '@/lib/social-links'
import { SocialIconLink } from '@/components/ui'
import { EmailIcon } from '@/components/icons'

const sitemapLinks = {
  main: [
    { label: 'Home', href: '/' },
    { label: 'Events', href: '/events' },
    { label: 'Bands', href: '/events' },
    { label: 'Companies', href: '/companies' },
    { label: 'Songs', href: '/songs' },
  ],
  media: [
    { label: 'Photos', href: '/photos' },
    { label: 'Videos', href: '/videos' },
    { label: 'Photographers', href: '/photographers' },
  ],
  info: [
    { label: 'About', href: '/about' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Use', href: '/terms' },
  ],
}

export interface FooterProps {
  /** Footer variant */
  variant?: 'simple' | 'full'
  className?: string
}

export function Footer({ variant = 'simple', className }: FooterProps) {
  const currentYear = new Date().getFullYear()

  if (variant === 'simple') {
    return (
      <footer className={cn('border-t border-white/5 py-8', className)}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Copyright */}
            <p className="text-text-dim text-sm">
              {currentYear} Battle of the Tech Bands. Supporting{' '}
              <a
                href="https://youngcare.com.au"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-white transition-colors"
              >
                Youngcare
              </a>
            </p>

            {/* Social Links */}
            <div className="flex items-center gap-4">
              {socialLinks.map((social) => (
                <SocialIconLink
                  key={social.label}
                  href={social.href}
                  platform={social.platform}
                  label={social.label}
                  location="footer_simple"
                  className="text-text-dim hover:text-white transition-colors"
                >
                  {social.icon()}
                </SocialIconLink>
              ))}
            </div>
          </div>
        </div>
      </footer>
    )
  }

  // Full footer variant
  return (
    <footer className={cn('border-t border-white/5 pt-12 pb-8', className)}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Main footer content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Logo and tagline */}
          <div className="md:col-span-2">
            <Link href="/" className="inline-block mb-4">
              <Image
                src="/images/logos/bottb-dark-square.png"
                alt="BOTTB"
                width={64}
                height={64}
                className="h-16 w-auto"
              />
            </Link>
            <p className="text-text-muted max-w-md">
              Where technology meets rock &apos;n&apos; roll. A community
              charity event supporting Youngcare.
            </p>

            {/* Contact */}
            <div className="mt-6 space-y-2">
              <a
                href="mailto:info@bottb.com"
                className="flex items-center gap-2 text-text-dim hover:text-white transition-colors"
              >
                <EmailIcon size={16} />
                info@bottb.com
              </a>
            </div>
          </div>

          {/* Lineup Links */}
          <div>
            <h3 className="text-white font-medium mb-4 text-sm tracking-widest uppercase">
              Lineup
            </h3>
            <ul className="space-y-2">
              {sitemapLinks.main.map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    href={link.href}
                    className="text-text-dim hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Media Links */}
          <div>
            <h3 className="text-white font-medium mb-4 text-sm tracking-widest uppercase">
              Media
            </h3>
            <ul className="space-y-2">
              {sitemapLinks.media.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-text-dim hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Social icons */}
            <div className="flex items-center gap-4 mt-6">
              {socialLinks.map((social) => (
                <SocialIconLink
                  key={social.label}
                  href={social.href}
                  platform={social.platform}
                  label={social.label}
                  location="footer_full"
                  className="text-text-dim hover:text-white transition-colors"
                >
                  {social.icon()}
                </SocialIconLink>
              ))}
            </div>
          </div>

          {/* Info & Legal */}
          <div>
            <h3 className="text-white font-medium mb-4 text-sm tracking-widest uppercase">
              Info
            </h3>
            <ul className="space-y-2">
              {sitemapLinks.info.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-text-dim hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-text-dim text-sm">
              © {currentYear} Battle of the Tech Bands
            </p>
            <p className="text-text-dim text-sm">
              Proudly supporting{' '}
              <a
                href="https://youngcare.com.au"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent-light transition-colors"
              >
                Youngcare
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
