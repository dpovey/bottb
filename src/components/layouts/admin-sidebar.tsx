'use client'

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
} from '@/components/icons'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  matchPath?: string[]
}

const mainNavItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: <HomeIcon className="w-5 h-5" />,
    matchPath: ['/admin'],
  },
  {
    label: 'Events',
    href: '/admin/events',
    icon: <CalendarIcon className="w-5 h-5" />,
    matchPath: ['/admin/events'],
  },
  {
    label: 'Videos',
    href: '/admin/videos',
    icon: <VideoIcon className="w-5 h-5" />,
    matchPath: ['/admin/videos'],
  },
  {
    label: 'Photos',
    href: '/photos',
    icon: <PhotoIcon className="w-5 h-5" />,
    matchPath: ['/photos'],
  },
]

const settingsNavItems: NavItem[] = [
  {
    label: 'Social Accounts',
    href: '/admin/social',
    icon: <ShareIcon className="w-5 h-5" />,
    matchPath: ['/admin/social'],
  },
]

function NavLink({
  item,
  currentPath,
}: {
  item: NavItem
  currentPath: string
}) {
  const isActive = item.matchPath?.some((path) => {
    if (path === '/admin') {
      return currentPath === '/admin'
    }
    return currentPath.startsWith(path)
  })

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
        isActive
          ? 'bg-accent/10 text-accent'
          : 'text-muted hover:bg-white/5 hover:text-white'
      )}
    >
      {item.icon}
      <span className="text-sm font-medium">{item.label}</span>
    </Link>
  )
}

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
        <ul className="space-y-1">
          {mainNavItems.map((item) => (
            <li key={item.href}>
              <NavLink item={item} currentPath={pathname} />
            </li>
          ))}
        </ul>

        <div className="mt-8 pt-8 border-t border-white/5">
          <p className="px-4 mb-2 text-[10px] tracking-widest uppercase text-dim">
            Settings
          </p>
          <ul className="space-y-1">
            {settingsNavItems.map((item) => (
              <li key={item.href}>
                <NavLink item={item} currentPath={pathname} />
              </li>
            ))}
          </ul>
        </div>
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
