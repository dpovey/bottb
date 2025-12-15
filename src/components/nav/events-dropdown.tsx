"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  status: "upcoming" | "voting" | "finalized";
  info?: {
    winner?: string;
    [key: string]: unknown;
  };
}

interface EventsDropdownProps {
  /** Additional className for the trigger button */
  className?: string;
}

export function EventsDropdown({ className }: EventsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Track if component is mounted for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch events on mount
  useEffect(() => {
    async function fetchEvents() {
      try {
        const [pastRes, upcomingRes] = await Promise.all([
          fetch("/api/events/past"),
          fetch("/api/events/upcoming"),
        ]);

        if (upcomingRes.ok) {
          const data = await upcomingRes.json();
          setUpcomingEvents(Array.isArray(data) ? data : []);
        }

        if (pastRes.ok) {
          const data = await pastRes.json();
          // Sort by date descending and take first 5
          const sorted = (Array.isArray(data) ? data : [])
            .sort((a: Event, b: Event) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);
          setPastEvents(sorted);
        }
      } catch (error) {
        console.error("Failed to fetch events:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
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

  // Format date for display
  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-AU", {
      month: "short",
      day: "numeric",
    });
  }

  const hasEvents = upcomingEvents.length > 0 || pastEvents.length > 0;

  // Dropdown panel - rendered via portal to avoid nested backdrop-filter issue
  const dropdownPanel = (
    <div
      ref={panelRef}
      id="events-dropdown-panel"
      role="menu"
      aria-labelledby="events-dropdown-trigger"
      className={cn(
        "fixed left-0 right-0 z-40",
        "bg-bg/40 backdrop-blur-[40px] saturate-150",
        "border-b border-white/[0.08]",
        "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)]",
        "transition-all duration-300 ease-out",
        isOpen
          ? "opacity-100 translate-y-0 visible"
          : "opacity-0 -translate-y-2 invisible"
      )}
      style={{ top: "64px" }} // Header height
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        {loading ? (
          <div className="text-center py-8 text-text-muted text-sm">
            Loading events...
          </div>
        ) : !hasEvents ? (
          <div className="text-center py-8 text-text-muted text-sm">
            No events found
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-x-12">
            {/* Upcoming Events Column */}
            {upcomingEvents.length > 0 && (
              <div>
                <div className="text-text-muted text-[10px] tracking-[0.2em] uppercase font-medium px-6 pb-2 pt-1">
                  Upcoming Events
                </div>
                {upcomingEvents.map((event, index) => (
                  <Link
                    key={event.id}
                    href={`/event/${event.id}`}
                    onClick={() => setIsOpen(false)}
                    role="menuitem"
                    className={cn(
                      "flex items-center gap-4 px-6 py-3 rounded-lg",
                      "hover:bg-white/5 transition-colors",
                      "opacity-0 -translate-y-1",
                      isOpen && "animate-dropdown-item"
                    )}
                    style={{
                      animationDelay: isOpen ? `${index * 30}ms` : "0ms",
                      animationFillMode: "forwards",
                    }}
                  >
                    <span className="text-xs text-text-dim min-w-[60px]">
                      {formatDate(event.date)}
                    </span>
                    <div>
                      <div className="text-white font-medium">{event.name}</div>
                      <div className="text-text-muted text-xs">{event.location}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Past Events Column */}
            {pastEvents.length > 0 && (
              <div>
                <div className="text-text-muted text-[10px] tracking-[0.2em] uppercase font-medium px-6 pb-2 pt-1">
                  Past Events
                </div>
                {pastEvents.map((event, index) => (
                  <Link
                    key={event.id}
                    href={`/results/${event.id}`}
                    onClick={() => setIsOpen(false)}
                    role="menuitem"
                    className={cn(
                      "flex items-center gap-4 px-6 py-3 rounded-lg",
                      "hover:bg-white/5 transition-colors",
                      "opacity-0 -translate-y-1",
                      isOpen && "animate-dropdown-item"
                    )}
                    style={{
                      animationDelay: isOpen ? `${(upcomingEvents.length + index) * 30}ms` : "0ms",
                      animationFillMode: "forwards",
                    }}
                  >
                    <span className="text-xs text-text-dim min-w-[60px]">
                      {formatDate(event.date)}
                    </span>
                    <div>
                      <div className="text-white font-medium">{event.name}</div>
                      {event.info?.winner ? (
                        <div className="text-text-muted text-xs">🏆 {event.info.winner}</div>
                      ) : (
                        <div className="text-text-muted text-xs">{event.location}</div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer link */}
        {hasEvents && (
          <div className="mt-6 pt-4 border-t border-white/5">
            <Link
              href="/"
              onClick={() => setIsOpen(false)}
              className={cn(
                "inline-flex items-center gap-2 px-6 py-2 rounded-lg",
                "text-text-muted hover:text-white text-sm transition-colors"
              )}
            >
              View all events
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}
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
        aria-controls="events-dropdown-panel"
        className={cn(
          "flex items-center gap-1.5 text-sm tracking-widest uppercase transition-colors relative",
          isOpen ? "text-white" : "text-text-muted hover:text-white",
          className
        )}
      >
        Events
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
      {mounted && createPortal(dropdownPanel, document.body)}
    </>
  );
}
