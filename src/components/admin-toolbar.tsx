"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  SettingsIcon,
  HomeIcon,
  CalendarIcon,
  PhotoIcon,
  LogoutIcon,
  CloseIcon,
} from "@/components/icons";

export function AdminToolbar() {
  const { data: session, status } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    // Check localStorage for collapsed state
    // Use setTimeout to defer setState out of synchronous effect body
    const collapsed = localStorage.getItem("admin-toolbar-collapsed");
    setTimeout(() => {
      if (collapsed === "false") {
        setIsCollapsed(false);
      }
      setIsHydrated(true);
    }, 0);
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
        <SettingsIcon className="w-5 h-5" />
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
        <HomeIcon className="w-5 h-5" />
      </Link>

      {/* Events Link */}
      <Link
        href="/admin/events"
        className="p-2 rounded-xl hover:bg-white/10 transition-colors text-text-muted hover:text-white"
        title="Manage Events"
      >
        <CalendarIcon className="w-5 h-5" />
      </Link>

      {/* Photos Link */}
      <Link
        href="/photos"
        className="p-2 rounded-xl hover:bg-white/10 transition-colors text-text-muted hover:text-white"
        title="Photos"
      >
        <PhotoIcon className="w-5 h-5" />
      </Link>

      {/* Divider */}
      <div className="w-px h-6 bg-white/10" />

      {/* Sign Out */}
      <button
        onClick={() => signOut()}
        className="p-2 rounded-xl hover:bg-error/20 transition-colors text-text-muted hover:text-error"
        title="Sign Out"
      >
        <LogoutIcon className="w-5 h-5" />
      </button>

      {/* Collapse Button */}
      <button
        onClick={toggleCollapsed}
        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
        title="Collapse"
      >
        <CloseIcon className="w-5 h-5 text-text-muted" />
      </button>
    </div>
  );
}






