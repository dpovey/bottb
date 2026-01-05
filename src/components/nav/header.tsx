'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Breadcrumbs, type BreadcrumbItem } from './breadcrumbs'
import { EventsDropdown, type NavEvent } from './events-dropdown'
import { LineupDropdown } from './lineup-dropdown'
import { ExperienceDropdown } from './experience-dropdown'
import { trackNavClick } from '@/lib/analytics'
import { CloseIcon, MenuIcon, SearchIcon } from '@/components/icons'
import { SearchDialog, useSearch } from '@/components/search'

export interface HeaderProps {
  /** Show main navigation links */
  showNav?: boolean
  /** Optional breadcrumbs to display */
  breadcrumbs?: BreadcrumbItem[]
  /** Background style - "transparent" starts clear and becomes glass on scroll */
  variant?: 'transparent' | 'glass' | 'solid'
  /** Make header fixed/sticky */
  fixed?: boolean
  /** SSR-provided nav events */
  navEvents?: {
    upcoming: NavEvent[]
    past: NavEvent[]
  }
}

// Mobile menu links - grouped by section
const mobileMenuSections = [
  {
    title: 'Events',
    links: [{ href: '/events', label: 'All Events' }],
  },
  {
    title: 'Lineup',
    links: [
      { href: '/companies', label: 'Bands' },
      { href: '/songs', label: 'Songs' },
    ],
  },
  {
    title: 'Gallery',
    links: [
      { href: '/photos', label: 'Photos' },
      { href: '/videos', label: 'Videos' },
      { href: '/photographers', label: 'Photographers' },
    ],
  },
]

export function Header({
  showNav = true,
  breadcrumbs,
  variant = 'glass',
  fixed = true,
  navEvents,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const search = useSearch()

  // Detect Mac for keyboard shortcut display
  const isMac =
    typeof navigator !== 'undefined' &&
    navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const searchShortcut = isMac ? '⌘K' : 'Ctrl+K'

  // Track scroll position for transparent variant auto-glass effect
  useEffect(() => {
    if (variant !== 'transparent') return

    const handleScroll = () => {
      // Trigger glass effect after scrolling 50px
      setIsScrolled(window.scrollY > 50)
    }

    // Check initial scroll position
    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [variant])

  // Determine if we should show the glass effect
  const showGlass =
    variant === 'glass' || (variant === 'transparent' && isScrolled)

  return (
    <>
      {/* Main Header */}
      <header
        className={cn(
          'z-50 transition-all duration-300',
          {
            'fixed top-0 left-0 right-0': fixed,
            relative: !fixed,
          },
          // Glass effect styles (uses glass-nav for bottom-border only variant)
          showGlass && 'glass-nav',
          // Transparent state (before scroll or when variant is transparent and not scrolled)
          variant === 'transparent' && !isScrolled && 'bg-transparent',
          // Solid variant
          variant === 'solid' && 'bg-bg border-b border-white/5'
        )}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center h-16">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center shrink-0"
              aria-label="Home"
            >
              {/* Square logo for mobile - SVG for sharp rendering at any size */}
              <Image
                src="/images/logos/bottb-dark-square.svg"
                alt="BOTTB"
                width={40}
                height={40}
                className="h-10 w-auto sm:hidden transition-transform duration-200 motion-safe:hover:scale-105"
              />
              {/* Horizontal logo for desktop */}
              <Image
                src="/images/logos/bottb-horizontal.png"
                alt="Battle of the Tech Bands"
                width={160}
                height={40}
                className="h-10 w-auto hidden sm:block transition-transform duration-200 motion-safe:hover:scale-105"
              />
            </Link>

            {/* Desktop Navigation (centered) */}
            {showNav && (
              <nav className="hidden md:flex items-center justify-center gap-8 flex-1">
                {/* Events Dropdown */}
                <EventsDropdown
                  initialUpcoming={navEvents?.upcoming}
                  initialPast={navEvents?.past}
                />

                {/* Lineup Dropdown */}
                <LineupDropdown />

                {/* Gallery Dropdown */}
                <ExperienceDropdown />

                {/* About link */}
                <Link
                  href="/about"
                  onClick={() =>
                    trackNavClick({ nav_item: 'about', location: 'header' })
                  }
                  className="text-sm tracking-widest uppercase text-text-muted hover:text-white transition-colors py-3 -my-3"
                >
                  About
                </Link>

                {/* Search button */}
                <button
                  onClick={search.open}
                  className="text-text-muted hover:text-white rounded-lg hover:bg-white/5 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Search"
                  title={`Search (${searchShortcut})`}
                >
                  <SearchIcon className="w-5 h-5" />
                </button>
              </nav>
            )}

            {/* Breadcrumbs (right side on desktop) */}
            {breadcrumbs && breadcrumbs.length > 0 && (
              <div className="hidden md:block min-w-0 max-w-[40%] lg:max-w-[50%]">
                <Breadcrumbs items={breadcrumbs} />
              </div>
            )}

            {/* Mobile Search + Menu Buttons */}
            <div className="md:hidden ml-auto flex items-center">
              <button
                onClick={search.open}
                className="text-text-muted hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Search"
              >
                <SearchIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-text-muted hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <CloseIcon className="w-6 h-6" />
                ) : (
                  <MenuIcon className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && showNav && (
          <div className="md:hidden bg-bg-elevated border-t border-white/5">
            <nav className="px-6 py-4 space-y-4">
              {/* Grouped sections */}
              {mobileMenuSections.map((section, sectionIndex) => (
                <div key={section.title}>
                  {sectionIndex > 0 && (
                    <div className="border-t border-white/5 pt-4" />
                  )}
                  <div className="text-[10px] tracking-widest uppercase text-text-dim mb-2">
                    {section.title}
                  </div>
                  <div className="-my-1">
                    {section.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => {
                          trackNavClick({
                            nav_item: link.label.toLowerCase(),
                            nav_section: section.title.toLowerCase(),
                            location: 'mobile_menu',
                          })
                          setMobileMenuOpen(false)
                        }}
                        className="block py-3 text-sm tracking-widest uppercase text-text-muted hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              {/* About link */}
              <div className="border-t border-white/5 pt-4 -mb-1">
                <Link
                  href="/about"
                  onClick={() => {
                    trackNavClick({
                      nav_item: 'about',
                      location: 'mobile_menu',
                    })
                    setMobileMenuOpen(false)
                  }}
                  className="block py-3 text-sm tracking-widest uppercase text-text-muted hover:text-white transition-colors"
                >
                  About
                </Link>
              </div>

              {/* Mobile Breadcrumbs */}
              {breadcrumbs && breadcrumbs.length > 0 && (
                <div className="pt-4 border-t border-white/5">
                  <Breadcrumbs items={breadcrumbs} />
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Spacer for fixed header */}
      {fixed && <div className="h-16" />}

      {/* Search Dialog */}
      <SearchDialog isOpen={search.isOpen} onClose={search.close} />
    </>
  )
}
