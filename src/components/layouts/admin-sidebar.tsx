'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { resetIdentity } from '@/lib/analytics'
import {
  HomeIcon,
  CalendarIcon,
  VideoIcon,
  PhotoIcon,
  ShareIcon,
  LogoutIcon,
  BuildingIcon,
  CameraIcon,
  StarIcon,
  GridIcon,
  UsersIcon,
  ChevronDownIcon,
} from '@/components/icons'

// ============================================================================
// Types
// ============================================================================

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  /** Paths that should mark this item as active */
  matchPath?: string[]
}

interface NavSection {
  /** Section label (displayed as header) */
  label?: string
  /** Items in this section */
  items: NavItem[]
  /** Whether this section is collapsible */
  collapsible?: boolean
  /** ID for collapsible state management */
  id?: string
}

// ============================================================================
// Navigation Configuration
// ============================================================================

/**
 * Admin sidebar navigation structure.
 *
 * To add a new admin page to the sidebar:
 * 1. Add an entry to the appropriate section's `items` array
 * 2. Include `href` (admin route), `label`, `icon`, and `matchPath`
 * 3. For nested items in collapsible sections, add to that section's items
 *
 * Section types:
 * - No label: Items displayed at top level (Dashboard)
 * - With label: Section header shown above items
 * - collapsible: true: Section can expand/collapse (auto-expands when child active)
 */
const navSections: NavSection[] = [
  // Dashboard - no section header, always visible at top
  {
    items: [
      {
        label: 'Dashboard',
        href: '/admin',
        icon: <HomeIcon className="w-5 h-5" />,
        matchPath: ['/admin'],
      },
    ],
  },
  // Events section
  {
    label: 'Events',
    items: [
      {
        label: 'Events',
        href: '/admin/events',
        icon: <CalendarIcon className="w-5 h-5" />,
        matchPath: ['/admin/events'],
      },
    ],
  },
  // Photos section - collapsible with nested items
  {
    label: 'Photos',
    id: 'photos',
    collapsible: true,
    items: [
      {
        label: 'Photos',
        href: '/admin/photos',
        icon: <PhotoIcon className="w-5 h-5" />,
        matchPath: ['/admin/photos'],
      },
      {
        label: 'Grouping',
        href: '/admin/photos/grouping',
        icon: <GridIcon className="w-5 h-5" />,
        matchPath: ['/admin/photos/grouping'],
      },
      {
        label: 'People',
        href: '/admin/photos/people',
        icon: <UsersIcon className="w-5 h-5" />,
        matchPath: ['/admin/photos/people'],
      },
      {
        label: 'Heroes',
        href: '/admin/heroes',
        icon: <StarIcon className="w-5 h-5" />,
        matchPath: ['/admin/heroes'],
      },
    ],
  },
  // Content section
  {
    label: 'Content',
    items: [
      {
        label: 'Videos',
        href: '/admin/videos',
        icon: <VideoIcon className="w-5 h-5" />,
        matchPath: ['/admin/videos'],
      },
    ],
  },
  // Directory section
  {
    label: 'Directory',
    items: [
      {
        label: 'Companies',
        href: '/admin/companies',
        icon: <BuildingIcon className="w-5 h-5" />,
        matchPath: ['/admin/companies'],
      },
      {
        label: 'Photographers',
        href: '/admin/photographers',
        icon: <CameraIcon className="w-5 h-5" />,
        matchPath: ['/admin/photographers'],
      },
    ],
  },
  // Settings section
  {
    label: 'Settings',
    items: [
      {
        label: 'Social Accounts',
        href: '/admin/social',
        icon: <ShareIcon className="w-5 h-5" />,
        matchPath: ['/admin/social'],
      },
    ],
  },
]

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if the current path matches any of the item's matchPath patterns
 */
function isItemActive(item: NavItem, currentPath: string): boolean {
  return (
    item.matchPath?.some((path) => {
      // Exact match for /admin (dashboard)
      if (path === '/admin') {
        return currentPath === '/admin'
      }
      // For other paths, check if current path starts with the match path
      // but exclude partial matches (e.g., /admin/photos shouldn't match /admin/photos/grouping)
      if (currentPath === path) {
        return true
      }
      // Check for child routes (e.g., /admin/photos/123 matches /admin/photos)
      return currentPath.startsWith(path + '/')
    }) ?? false
  )
}

/**
 * Check if any item in a section is currently active
 */
function isSectionActive(section: NavSection, currentPath: string): boolean {
  return section.items.some((item) => isItemActive(item, currentPath))
}

// ============================================================================
// Components
// ============================================================================

function NavLink({
  item,
  currentPath,
  nested = false,
}: {
  item: NavItem
  currentPath: string
  nested?: boolean
}) {
  const isActive = isItemActive(item, currentPath)

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg transition-colors',
        nested ? 'px-4 py-2 pl-11' : 'px-4 py-3',
        isActive
          ? 'bg-accent/10 text-accent'
          : 'text-muted hover:bg-white/5 hover:text-white'
      )}
    >
      {item.icon}
      <span className={cn('font-medium', nested ? 'text-xs' : 'text-sm')}>
        {item.label}
      </span>
    </Link>
  )
}

function CollapsibleSection({
  section,
  currentPath,
}: {
  section: NavSection
  currentPath: string
}) {
  const sectionActive = isSectionActive(section, currentPath)
  // Auto-expand when any child is active, otherwise remember user preference
  const [isExpanded, setIsExpanded] = useState(sectionActive)

  // Always show expanded if a child is active
  const showExpanded = sectionActive || isExpanded

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-2 text-[10px] tracking-widest uppercase transition-colors',
          sectionActive ? 'text-accent' : 'text-dim hover:text-muted'
        )}
      >
        <span>{section.label}</span>
        <ChevronDownIcon
          className={cn(
            'w-4 h-4 transition-transform duration-200',
            showExpanded ? 'rotate-0' : '-rotate-90'
          )}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          showExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <ul className="space-y-1 pb-2">
          {section.items.map((item) => (
            <li key={item.href}>
              <NavLink item={item} currentPath={currentPath} nested />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function NavSectionComponent({
  section,
  currentPath,
  isFirst,
}: {
  section: NavSection
  currentPath: string
  isFirst: boolean
}) {
  // Collapsible sections get special treatment
  if (section.collapsible && section.label) {
    return (
      <div className={cn(!isFirst && 'mt-6 pt-6 border-t border-white/5')}>
        <CollapsibleSection section={section} currentPath={currentPath} />
      </div>
    )
  }

  // Regular sections
  return (
    <div className={cn(!isFirst && 'mt-6 pt-6 border-t border-white/5')}>
      {section.label && (
        <p className="px-4 mb-2 text-[10px] tracking-widest uppercase text-dim">
          {section.label}
        </p>
      )}
      <ul className="space-y-1">
        {section.items.map((item) => (
          <li key={item.href}>
            <NavLink item={item} currentPath={currentPath} />
          </li>
        ))}
      </ul>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function AdminSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const userInitials = session?.user?.name
    ? session.user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : session?.user?.email?.slice(0, 2).toUpperCase() || 'AD'

  return (
    <aside className="w-64 bg-elevated border-r border-white/5 flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logos/bottb-dark-square.svg"
            alt="BOTTB"
            className="h-8"
          />
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">BOTTB</span>
            <span className="bg-accent/20 text-accent px-1.5 py-0.5 rounded-sm text-[9px] tracking-wider uppercase font-medium">
              Admin
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        {navSections.map((section, index) => (
          <NavSectionComponent
            key={section.id || section.label || index}
            section={section}
            currentPath={pathname}
            isFirst={index === 0}
          />
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
            <span className="text-accent text-sm font-medium">
              {userInitials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {session?.user?.name || session?.user?.email || 'Admin'}
            </p>
            <p className="text-xs text-dim truncate">Admin</p>
          </div>
          <button
            onClick={() => {
              resetIdentity()
              signOut()
            }}
            className="text-dim hover:text-white transition-colors"
            title="Sign out"
          >
            <LogoutIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
