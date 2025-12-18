"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useFeatureFlagPayload, useFeatureFlagVariantKey } from "posthog-js/react";
import { cn } from "@/lib/utils";
import { trackNavClick } from "@/lib/analytics";
import {
  FEATURE_FLAGS,
  DEFAULT_NAV_MEDIA_LABEL,
  type NavMediaLabelPayload,
} from "@/lib/feature-flags";

interface ExperienceDropdownProps {
  /** Additional className for the trigger button */
  className?: string;
}

const experienceLinks = [
  {
    href: "/photos",
    label: "Photos",
    description: "Event photo galleries",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
  {
    href: "/videos",
    label: "Videos",
    description: "Performance highlights",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
      </svg>
    ),
  },
  {
    href: "/photographers",
    label: "Photographers",
    description: "Our talented photographers",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
      </svg>
    ),
  },
];

export function ExperienceDropdown({ className }: ExperienceDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Get feature flag variant and payload from PostHog
  const variant = useFeatureFlagVariantKey(FEATURE_FLAGS.NAV_MEDIA_LABEL);
  const payload = useFeatureFlagPayload(FEATURE_FLAGS.NAV_MEDIA_LABEL) as NavMediaLabelPayload | undefined;
  
  // Use the label from payload, fallback to default
  const navLabel = payload?.label ?? DEFAULT_NAV_MEDIA_LABEL;

  // Track if component is mounted for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        triggerRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const handleLinkClick = (label: string) => {
    trackNavClick({
      nav_item: label.toLowerCase(),
      nav_section: navLabel.toLowerCase(),
      variant: variant as string | undefined,
      location: "header",
    });
    setIsOpen(false);
  };

  // Dropdown panel - rendered via portal to avoid nested backdrop-filter issue
  const dropdownPanel = (
    <div
      ref={panelRef}
      id="experience-dropdown-panel"
      role="menu"
      aria-labelledby="experience-dropdown-trigger"
      className={cn(
        "fixed left-0 right-0 z-40",
        "bg-bg/40 backdrop-blur-[40px] saturate-150",
        "border-b border-white/[0.08]",
        "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)]"
      )}
      style={{ top: "64px" }} // Header height
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <div className="grid md:grid-cols-3 gap-4">
          {experienceLinks.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => handleLinkClick(link.label)}
              role="menuitem"
              className={cn(
                "flex items-start gap-4 p-4 rounded-lg",
                "hover:bg-white/5 transition-colors",
                "opacity-0 -translate-y-1 animate-dropdown-item"
              )}
              style={{
                animationDelay: `${index * 30}ms`,
                animationFillMode: "forwards",
              }}
            >
              <div className="shrink-0 w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-text-muted">
                {link.icon}
              </div>
              <div>
                <div className="text-white font-medium">{link.label}</div>
                <div className="text-text-muted text-sm">{link.description}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="experience-dropdown-panel"
        className={cn(
          "flex items-center gap-1.5 text-sm tracking-widest uppercase transition-colors relative",
          isOpen ? "text-white" : "text-text-muted hover:text-white",
          className
        )}
      >
        {navLabel}
        <svg
          className={cn(
            "w-4 h-4 transition-transform duration-300",
            isOpen && "rotate-180"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        
        {/* Accent underline indicator */}
        <span
          className={cn(
            "absolute -bottom-1 left-0 right-0 h-0.5 bg-accent transition-transform duration-300 origin-left",
            isOpen ? "scale-x-100" : "scale-x-0"
          )}
        />
      </button>

      {/* Dropdown Panel - rendered via portal outside header to avoid nested backdrop-filter */}
      {mounted && isOpen && createPortal(dropdownPanel, document.body)}
    </>
  );
}

