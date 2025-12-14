"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function AdminToolbar() {
  const { data: session, status } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Check localStorage for collapsed state
    const collapsed = localStorage.getItem("admin-toolbar-collapsed");
    if (collapsed === "false") {
      setIsCollapsed(false);
    }
    setIsHydrated(true);
  }, []);

  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("admin-toolbar-collapsed", String(newState));
  };

  // Don't show if not logged in or not admin
  if (status === "loading" || !session?.user?.isAdmin) {
    return null;
  }

  // Don't render until hydrated to avoid mismatch
  if (!isHydrated) {
    return null;
  }

  // Collapsed state - FAB
  if (isCollapsed) {
    return (
      <button
        onClick={toggleCollapsed}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "w-12 h-12 rounded-full",
          "bg-bg/90 backdrop-blur-lg",
          "border border-accent/30",
          "shadow-lg shadow-black/40",
          "flex items-center justify-center",
          "text-accent hover:text-accent-light",
          "hover:border-accent hover:scale-105",
          "transition-all duration-200"
        )}
        title="Open Admin Panel"
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
            strokeWidth={1.5}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>
    );
  }

  // Expanded state - Full toolbar
  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "bg-bg/90 backdrop-blur-lg",
        "border border-accent/30",
        "rounded-2xl",
        "shadow-lg shadow-black/40",
        "flex items-center gap-2 p-2"
      )}
    >
      {/* Admin Badge */}
      <span className="px-3 py-1 text-xs tracking-widest uppercase text-accent font-medium">
        Admin
      </span>

      {/* Divider */}
      <div className="w-px h-6 bg-white/10" />

      {/* Dashboard Link */}
      <Link
        href="/admin"
        className="p-2 rounded-xl hover:bg-white/10 transition-colors text-text-muted hover:text-white"
        title="Dashboard"
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
            strokeWidth={1.5}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      </Link>

      {/* Events Link */}
      <Link
        href="/admin/events"
        className="p-2 rounded-xl hover:bg-white/10 transition-colors text-text-muted hover:text-white"
        title="Manage Events"
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
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </Link>

      {/* Photos Link */}
      <Link
        href="/photos"
        className="p-2 rounded-xl hover:bg-white/10 transition-colors text-text-muted hover:text-white"
        title="Photos"
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
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </Link>

      {/* Divider */}
      <div className="w-px h-6 bg-white/10" />

      {/* Sign Out */}
      <button
        onClick={() => signOut()}
        className="p-2 rounded-xl hover:bg-error/20 transition-colors text-text-muted hover:text-error"
        title="Sign Out"
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
            strokeWidth={1.5}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
      </button>

      {/* Collapse Button */}
      <button
        onClick={toggleCollapsed}
        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
        title="Collapse"
      >
        <svg
          className="w-5 h-5 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

