"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { trackNavClick } from "@/lib/analytics";
import {
  ChevronDownIcon,
  UsersIcon,
  MusicNoteIcon,
} from "@/components/icons";

interface LineupDropdownProps {
  /** Additional className for the trigger button */
  className?: string;
}

const lineupLinks = [
  {
    href: "/companies",
    label: "Bands",
    description: "Tech companies represented",
    icon: <UsersIcon size={20} />,
  },
  {
    href: "/songs",
    label: "Songs",
    description: "Every song performed",
    icon: <MusicNoteIcon size={20} />,
  },
];

export function LineupDropdown({ className }: LineupDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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
      nav_section: "lineup",
      location: "header",
    });
    setIsOpen(false);
  };

  // Dropdown panel - rendered via portal to avoid nested backdrop-filter issue
  const dropdownPanel = (
    <div
      ref={panelRef}
      id="lineup-dropdown-panel"
      role="menu"
      aria-labelledby="lineup-dropdown-trigger"
      className={cn(
        "fixed left-0 right-0 z-40",
        "bg-bg/40 backdrop-blur-2xl saturate-150",
        "border-b border-white/8",
        "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)]"
      )}
      style={{ top: "64px" }} // Header height
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <div className="grid md:grid-cols-2 gap-4">
          {lineupLinks.map((link, index) => (
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
                <div className="text-white font-medium uppercase tracking-widest text-sm">{link.label}</div>
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
        aria-controls="lineup-dropdown-panel"
        className={cn(
          "flex items-center gap-1.5 text-sm tracking-widest uppercase transition-colors relative cursor-pointer",
          isOpen ? "text-white" : "text-text-muted hover:text-white",
          className
        )}
      >
        Lineup
        <ChevronDownIcon
          size={16}
          className={cn("transition-transform duration-300", isOpen && "rotate-180")}
          strokeWidth={2}
        />
        
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

