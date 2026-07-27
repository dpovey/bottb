import { Badge } from './badge'
import type { EarlyBirdOffer } from '@/lib/date-utils'

interface EarlyBirdBadgeProps {
  /**
   * Live offer from `getEarlyBirdOffer`. Nullish renders nothing, so an
   * expired offer retires itself without the caller branching.
   *
   * Resolved by the caller rather than here because the event page renders
   * inside a client component — "now" has to be settled on the server or the
   * badge risks hydrating against a different day.
   */
  offer?: EarlyBirdOffer | null
  /** Extra classes appended to the underlying Badge. */
  className?: string
}

/**
 * Urgency badge for a live early-bird ticket offer ("Early bird ends 1 Aug",
 * collapsing to "ends today"/"ends tomorrow" as the deadline closes — a bare
 * date stops conveying urgency once it's imminent).
 *
 * Uses the `warning` (amber) variant deliberately: it sits beside the event
 * countdown badge, which is `accent`/`info`, and the two need to read as
 * different deadlines rather than one repeated one.
 */
export function EarlyBirdBadge({ offer, className }: EarlyBirdBadgeProps) {
  if (!offer) return null

  const when =
    offer.daysLeft === 0
      ? 'today'
      : offer.daysLeft === 1
        ? 'tomorrow'
        : offer.endsLabelShort

  return (
    <Badge variant="warning" className={className}>
      Early bird ends {when}
    </Badge>
  )
}
