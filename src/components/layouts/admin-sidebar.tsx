"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  matchPath?: string[];
}

const mainNavItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
    matchPath: ["/admin"],
  },
  {
    label: "Events",
    href: "/admin/events",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
    matchPath: ["/admin/events"],
  },
  {
    label: "Videos",
    href: "/admin/videos",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
    ),
    matchPath: ["/admin/videos"],
  },
  {
    label: "Photos",
    href: "/photos",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
    matchPath: ["/photos"],
  },
];

const settingsNavItems: NavItem[] = [
  {
    label: "Social Accounts",
    href: "/admin/social",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
    ),
    matchPath: ["/admin/social"],
  },
];

function NavLink({
  item,
  currentPath,
}: {
  item: NavItem;
  currentPath: string;
}) {
  const isActive = item.matchPath?.some((path) => {
    if (path === "/admin") {
      return currentPath === "/admin";
    }
    return currentPath.startsWith(path);
  });

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
        isActive
          ? "bg-accent/10 text-accent"
          : "text-muted hover:bg-white/5 hover:text-white"
      )}
    >
      {item.icon}
      <span className="text-sm font-medium">{item.label}</span>
    </Link>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const userInitials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : session?.user?.email?.slice(0, 2).toUpperCase() || "AD";

  return (
    <aside className="w-64 bg-elevated border-r border-white/5 flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logos/bottb-dark-square.png"
            alt="BOTTB"
            className="h-8"
          />
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">BOTTB</span>
            <span className="bg-accent/20 text-accent px-1.5 py-0.5 rounded text-[9px] tracking-wider uppercase font-medium">
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
              {session?.user?.name || session?.user?.email || "Admin"}
            </p>
            <p className="text-xs text-dim truncate">Admin</p>
          </div>
          <button
            onClick={() => signOut()}
            className="text-dim hover:text-white transition-colors"
            title="Sign out"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
