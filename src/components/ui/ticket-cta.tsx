'use client'

import Link from 'next/link'
import { TicketIcon, ExternalLinkIcon } from '@/components/icons'
import { trackTicketClick } from '@/lib/analytics'

interface TicketCTAProps {
  ticketUrl: string
  eventId: string
  eventName: string
  variant?: 'default' | 'compact'
}

/**
 * Call-to-action button for purchasing event tickets.
 * Fires a conversion (Meta Lead + LinkedIn + PostHog) on press. Uses
 * pointerdown so beacons leave before target=_blank steals focus.
 */
export function TicketCTA({
  ticketUrl,
  eventId,
  eventName,
  variant = 'default',
}: TicketCTAProps) {
  const handleConversion = () => {
    trackTicketClick({
      event_id: eventId,
      event_name: eventName,
      ticket_url: ticketUrl,
      location: variant === 'compact' ? 'event_card' : 'event_page',
    })
  }

  if (variant === 'compact') {
    return (
      <Link
        href={ticketUrl}
        target="_blank"
        rel="noopener noreferrer"
        onPointerDown={handleConversion}
        className="inline-flex items-center gap-2 bg-accent text-bg rounded-full font-medium tracking-wide hover:bg-accent-light transition-colors group px-6 py-3 text-base sm:px-7 sm:py-3.5 sm:text-lg"
      >
        <TicketIcon className="w-5 h-5" />
        Get Tickets
        <ExternalLinkIcon className="opacity-60 group-hover:opacity-100 transition-opacity w-4 h-4" />
      </Link>
    )
  }

  return (
    <div className="bg-linear-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-2xl p-6 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-accent/10 mb-4">
        <TicketIcon className="w-7 h-7 text-accent" />
      </div>
      <h3 className="font-semibold text-xl mb-2">Get Your Tickets</h3>
      <p className="text-text-muted text-sm mb-6 max-w-md mx-auto">
        {eventName
          ? `Secure your spot at ${eventName}. All proceeds support Youngcare.`
          : 'Secure your spot at this event. All proceeds support Youngcare.'}
      </p>
      <Link
        href={ticketUrl}
        target="_blank"
        rel="noopener noreferrer"
        onPointerDown={handleConversion}
        className="inline-flex items-center gap-2 bg-accent text-bg rounded-full font-semibold tracking-wide hover:bg-accent-light transition-colors group w-full sm:w-auto justify-center px-10 py-4 text-lg"
      >
        Purchase Tickets
        <ExternalLinkIcon className="opacity-70 group-hover:opacity-100 transition-opacity w-5 h-5" />
      </Link>
      <p className="text-text-dim text-xs mt-4">Opens in a new tab</p>
    </div>
  )
}
