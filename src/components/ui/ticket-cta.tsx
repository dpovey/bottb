'use client'

import Link from 'next/link'
import { TicketIcon, ExternalLinkIcon, LightningIcon } from '@/components/icons'
import { trackTicketClick } from '@/lib/analytics'
import type { EarlyBirdOffer } from '@/lib/date-utils'

interface TicketCTAProps {
  ticketUrl: string
  eventId: string
  eventName: string
  variant?: 'default' | 'compact'
  /**
   * Live early-bird offer, from `getEarlyBirdOffer`. Resolved by the caller
   * rather than here so this stays a client component without pulling "now"
   * into the render — pass null/undefined once the deadline passes.
   */
  earlyBird?: EarlyBirdOffer | null
}

/**
 * Deadline sentence for a live early-bird offer, e.g. "Early bird $45 ends
 * 1 August" — collapsing to "ends today"/"ends tomorrow" as it closes, since
 * a bare date stops conveying urgency once it's imminent.
 */
function earlyBirdSentence(offer: EarlyBirdOffer): string {
  const lead = offer.price ? `Early bird ${offer.price}` : 'Early bird pricing'
  if (offer.daysLeft === 0) return `${lead} ends today`
  if (offer.daysLeft === 1) return `${lead} ends tomorrow`
  return `${lead} ends ${offer.endsLabel}`
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
  earlyBird,
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
      <div className="flex flex-col items-end gap-2">
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
        {earlyBird && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/20 px-3 py-1 text-xs font-medium text-warning-light backdrop-blur-md [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
            <LightningIcon className="w-3.5 h-3.5" />
            {earlyBirdSentence(earlyBird)}
          </span>
        )}
      </div>
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
      {earlyBird && (
        <div className="mb-6 inline-flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <LightningIcon className="w-4 h-4 shrink-0 text-warning-light" />
          {/* One text flow rather than sibling spans, so the clause reads as a
              sentence and wraps naturally on narrow cards. */}
          <p className="text-left">
            <span className="font-semibold text-warning-light">
              {earlyBirdSentence(earlyBird)}
            </span>
            {earlyBird.daysLeft > 1 && (
              <span className="text-text-muted">
                {' '}
                — only {earlyBird.daysLeft} days left
              </span>
            )}
          </p>
        </div>
      )}
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
