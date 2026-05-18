'use client'

import Link from 'next/link'
import { trackTicketClick } from '@/lib/analytics'

interface TrackedTicketLinkProps {
  ticketUrl: string
  eventId: string
  eventName: string
  location: 'event_card' | 'event_card_visual'
  className: string
  children: React.ReactNode
}

/**
 * Client-side wrapper for inline ticket pills inside server-rendered cards.
 * Fires a conversion (Meta Lead + LinkedIn + PostHog) on pointer-down so
 * beacons leave before target=_blank steals focus.
 */
export function TrackedTicketLink({
  ticketUrl,
  eventId,
  eventName,
  location,
  className,
  children,
}: TrackedTicketLinkProps) {
  return (
    <Link
      href={ticketUrl}
      target="_blank"
      rel="noopener noreferrer"
      onPointerDown={() =>
        trackTicketClick({
          event_id: eventId,
          event_name: eventName,
          ticket_url: ticketUrl,
          location,
        })
      }
      className={className}
    >
      {children}
    </Link>
  )
}
