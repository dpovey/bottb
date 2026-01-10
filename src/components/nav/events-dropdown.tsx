'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ChevronDownIcon, ChevronRightIcon } from '@/components/icons'
import { CompanyBadge } from '@/components/ui/company-badge'

export interface NavEvent {
  id: string
  name: string
  date: string
  location: string
  status: 'upcoming' | 'voting' | 'finalized'
  info?: {
    winner?: string
    winner_company_slug?: string
    winner_company_name?: string
    winner_company_icon_url?: string
    [key: string]: unknown
  }
}

interface EventsDropdownProps {
  /** Additional className for the trigger button */
  className?: string
  /** SSR-provided upcoming events */
  initialUpcoming?: NavEvent[]
  /** SSR-provided past events */
  initialPast?: NavEvent[]
}

export function EventsDropdown({
  className,
  initialUpcoming,
  initialPast,
}: EventsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [upcomingEvents, setUpcomingEvents] = useState<NavEvent[]>(
    initialUpcoming || []
  )
  const [pastEvents, setPastEvents] = useState<NavEvent[]>(initialPast || [])
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(!initialUpcoming && !initialPast)
  const [hasFetched, setHasFetched] = useState(
    !!initialUpcoming || !!initialPast
  )
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Track if component is mounted for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Client-side fetch (only if no SSR data provided)
  const fetchEvents = useCallback(async () => {
    if (hasFetched) return
    setHasFetched(true)

    try {
      const [pastRes, upcomingRes] = await Promise.all([
        fetch('/api/events/past'),
        fetch('/api/events/upcoming'),
      ])

      if (upcomingRes.ok) {
        const data = await upcomingRes.json()
        setUpcomingEvents(Array.isArray(data) ? data : [])
      }

      if (pastRes.ok) {
        const data = await pastRes.json()
        const sorted = (Array.isArray(data) ? data : [])
          .sort(
            (a: NavEvent, b: NavEvent) =>
              new Date(b.date).getTime() - new Date(a.date).getTime()
          )
          .slice(0, 5)
        setPastEvents(sorted)
      }
    } catch (error) {
      console.error('Failed to fetch events:', error)
      setHasFetched(false)
    } finally {
      setLoading(false)
    }
  }, [hasFetched])

  // Prefetch on hover if no SSR data
  const handleMouseEnter = useCallback(() => {
    if (!hasFetched) fetchEvents()
  }, [hasFetched, fetchEvents])

  // Fetch on click if needed
  const handleClick = useCallback(() => {
    if (!hasFetched) fetchEvents()
    setIsOpen((prev) => !prev)
  }, [hasFetched, fetchEvents])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        triggerRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  // Format date for display
  function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-AU', {
      month: 'short',
      day: 'numeric',
    })
  }

  const hasEvents = upcomingEvents.length > 0 || pastEvents.length > 0

  // Dropdown panel - rendered via portal to avoid nested backdrop-filter issue
  const dropdownPanel = (
    <div
      ref={panelRef}
      id="events-dropdown-panel"
      role="menu"
      aria-labelledby="events-dropdown-trigger"
      className={cn(
        'fixed left-0 right-0 z-40',
        'bg-bg/40 backdrop-blur-2xl saturate-150',
        'border-b border-white/8',
        'shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)]'
      )}
      style={{ top: '64px' }} // Header height
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
                <div className="text-text-muted text-[10px] tracking-widest uppercase font-medium px-6 pb-2 pt-1">
                  Upcoming Events
                </div>
                {upcomingEvents.map((event, index) => (
                  <Link
                    key={event.id}
                    href={`/event/${event.id}`}
                    onClick={() => setIsOpen(false)}
                    role="menuitem"
                    className={cn(
                      'flex items-center gap-4 px-6 py-3 rounded-lg',
                      'hover:bg-white/5 transition-colors',
                      'opacity-0 -translate-y-1 animate-dropdown-item'
                    )}
                    style={{
                      animationDelay: `${index * 30}ms`,
                      animationFillMode: 'forwards',
                    }}
                  >
                    <span className="text-xs text-text-dim min-w-[60px]">
                      {formatDate(event.date)}
                    </span>
                    <div>
                      <div className="text-white font-medium uppercase tracking-widest text-sm">
                        {event.name}
                      </div>
                      <div className="text-text-muted text-xs">
                        {event.location}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Past Events Column */}
            {pastEvents.length > 0 && (
              <div>
                <div className="text-text-muted text-[10px] tracking-widest uppercase font-medium px-6 pb-2 pt-1">
                  Past Events
                </div>
                <div className="lg:grid lg:grid-cols-2 lg:gap-x-8">
                  {pastEvents.map((event, index) => (
                    <Link
                      key={event.id}
                      href={`/event/${event.id}`}
                      onClick={() => setIsOpen(false)}
                      role="menuitem"
                      className={cn(
                        'flex items-center gap-4 px-6 py-3 rounded-lg',
                        'hover:bg-white/5 transition-colors',
                        'opacity-0 -translate-y-1 animate-dropdown-item',
                        'break-inside-avoid'
                      )}
                      style={{
                        animationDelay: `${(upcomingEvents.length + index) * 30}ms`,
                        animationFillMode: 'forwards',
                      }}
                    >
                      <span className="text-xs text-text-dim min-w-[60px]">
                        {formatDate(event.date)}
                      </span>
                      <div>
                        <div className="text-white font-medium uppercase tracking-widest text-sm">
                          {event.name}
                        </div>
                        {event.info?.winner_company_slug &&
                        event.info?.winner_company_name ? (
                          <div className="text-text-muted text-xs flex items-center gap-1.5">
                            <span>Winner:</span>
                            <CompanyBadge
                              slug={event.info.winner_company_slug}
                              name={event.info.winner_company_name}
                              iconUrl={event.info.winner_company_icon_url}
                              variant="muted"
                              size="sm"
                              asLink={false}
                            />
                          </div>
                        ) : event.info?.winner ? (
                          <div className="text-text-muted text-xs flex items-center gap-1.5">
                            <span>Winner:</span>
                            <span>{event.info.winner}</span>
                          </div>
                        ) : (
                          <div className="text-text-muted text-xs">
                            {event.location}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer link */}
        {hasEvents && (
          <div className="mt-6 pt-4 border-t border-white/5">
            <Link
              href="/events"
              onClick={() => setIsOpen(false)}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-2 rounded-lg',
                'text-text-muted hover:text-white text-sm transition-colors'
              )}
            >
              All events
              <ChevronRightIcon size={16} strokeWidth={2} />
            </Link>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        aria-expanded={isOpen}
        aria-controls="events-dropdown-panel"
        className={cn(
          'flex items-center gap-1.5 text-sm tracking-widest uppercase transition-colors relative cursor-pointer py-3 -my-3',
          isOpen ? 'text-white' : 'text-text-muted hover:text-white',
          className
        )}
      >
        Events
        <ChevronDownIcon
          size={16}
          className={cn(
            'transition-transform duration-300',
            isOpen && 'rotate-180'
          )}
          strokeWidth={2}
        />
        {/* Accent underline indicator */}
        <span
          className={cn(
            'absolute -bottom-1 left-0 right-0 h-0.5 bg-accent transition-transform duration-300 origin-left',
            isOpen ? 'scale-x-100' : 'scale-x-0'
          )}
        />
      </button>

      {/* Dropdown Panel - rendered via portal outside header to avoid nested backdrop-filter */}
      {mounted && isOpen && createPortal(dropdownPanel, document.body)}
    </>
  )
}
