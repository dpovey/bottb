'use client'

import { useState } from 'react'
import { AdminSidebar } from './admin-sidebar'
import { AdminTopBar } from './admin-topbar'
import type { BreadcrumbItem } from '@/components/nav'

interface AdminLayoutProps {
  children: React.ReactNode
  /** Page title for the top bar */
  title?: string
  /** Page subtitle/description */
  subtitle?: string
  /** Breadcrumbs for navigation context (first crumb is auto-added) */
  breadcrumbs?: BreadcrumbItem[]
  /** Actions to show in the top bar */
  actions?: React.ReactNode
  /** Whether to show the top bar (default: true) */
  showTopBar?: boolean
  /** Whether content should have default padding (default: true) */
  padContent?: boolean
  /** Max width constraint for content (default: none) */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl' | 'full'
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '6xl': 'max-w-6xl',
  full: 'max-w-full',
}

export function AdminLayout({
  children,
  title,
  subtitle,
  breadcrumbs,
  actions,
  showTopBar = true,
  padContent = true,
  maxWidth,
}: AdminLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Desktop sidebar - hidden on mobile */}
      <div className="hidden lg:block">
        <AdminSidebar />
      </div>

      {/* Mobile sidebar drawer */}
      <AdminSidebar
        isMobileDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        {showTopBar && title && (
          <AdminTopBar
            title={title}
            subtitle={subtitle}
            breadcrumbs={breadcrumbs}
            actions={actions}
            onMenuToggle={() => setMobileMenuOpen(true)}
          />
        )}
        <div
          className={`flex-1 ${padContent ? 'p-4 lg:p-8' : ''} ${
            maxWidth ? maxWidthClasses[maxWidth] : ''
          }`}
        >
          {children}
        </div>
      </main>
    </div>
  )
}
