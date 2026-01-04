'use client'

import Link from 'next/link'
import type { BreadcrumbItem } from '@/components/nav'
import { ChevronRightIcon, MenuIcon } from '@/components/icons'

interface AdminTopBarProps {
  /** Page title */
  title: string
  /** Page subtitle/description */
  subtitle?: string
  /** Breadcrumb trail */
  breadcrumbs?: BreadcrumbItem[]
  /** Optional actions to show on the right side */
  actions?: React.ReactNode
  /** Callback to toggle mobile menu */
  onMenuToggle?: () => void
}

export function AdminTopBar({
  title,
  subtitle,
  breadcrumbs,
  actions,
  onMenuToggle,
}: AdminTopBarProps) {
  return (
    <header className="sticky top-0 z-10 bg-bg/80 backdrop-blur-lg border-b border-white/5 px-4 lg:px-8 py-3 lg:py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile menu button */}
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 -ml-2 text-muted hover:text-white transition-colors cursor-pointer"
            aria-label="Open menu"
          >
            <MenuIcon className="w-6 h-6" />
          </button>

          <div className="min-w-0">
            {/* Breadcrumbs - hidden on mobile */}
            {breadcrumbs && breadcrumbs.length > 0 && (
              <nav className="hidden sm:flex items-center gap-2 text-sm text-muted mb-1">
                {breadcrumbs.map((crumb, index) => (
                  <span key={index} className="flex items-center gap-2">
                    {index > 0 && (
                      <ChevronRightIcon size={12} strokeWidth={2} />
                    )}
                    {crumb.href ? (
                      <Link
                        href={crumb.href}
                        className="hover:text-white transition-colors"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-white">{crumb.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            )}
            {/* Title */}
            <h1 className="font-semibold text-xl lg:text-2xl truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs lg:text-sm text-muted mt-0.5 truncate hidden sm:block">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2 lg:gap-3 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}
