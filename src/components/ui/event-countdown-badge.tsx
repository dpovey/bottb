import { Badge, type BadgeProps } from './badge'
import { getEventCountdown } from '@/lib/date-utils'

interface EventCountdownBadgeProps {
  /** Event date as ISO string or Date. */
  date: string | Date
  /** IANA timezone name (e.g. "Australia/Melbourne") for calendar-day math. */
  timezone?: string
  /** Override "now" — primarily for tests / Storybook. Defaults to new Date(). */
  now?: Date
  /** Extra classes appended to the underlying Badge. */
  className?: string
  /**
   * Rendered when the event date has passed (countdown is null). Defaults
   * to nothing — callers can pass e.g. a "3 months ago" badge to keep the
   * slot occupied for events that are upcoming in the DB but past in
   * calendar terms.
   */
  fallback?: React.ReactNode
}

/**
 * Urgency badge showing how long until an upcoming event ("Tonight",
 * "Tomorrow", "{N} days left", "{N} weeks left"). Renders the `fallback`
 * for events whose date has passed in the event's local timezone.
 *
 * Variant escalates as the date approaches: `accent` within the final
 * week, `info` for events further out.
 */
export function EventCountdownBadge({
  date,
  timezone,
  now,
  className,
  fallback = null,
}: EventCountdownBadgeProps) {
  const label = getEventCountdown(date, timezone, now)
  if (!label) return <>{fallback}</>

  // accent within 7 days (Tonight / Tomorrow / N days left), info for 1+ weeks.
  const variant: BadgeProps['variant'] = label.includes('week')
    ? 'info'
    : 'accent'

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  )
}
