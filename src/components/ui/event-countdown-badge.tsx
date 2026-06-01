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
}

/**
 * Urgency badge showing how long until an upcoming event ("Tonight",
 * "Tomorrow", "{N} days left", "{N} weeks left"). Renders nothing for
 * events whose date has passed in the event's local timezone.
 *
 * Variant escalates as the date approaches: `accent` within the final
 * week, `info` for events further out.
 */
export function EventCountdownBadge({
  date,
  timezone,
  now,
  className,
}: EventCountdownBadgeProps) {
  const label = getEventCountdown(date, timezone, now)
  if (!label) return null

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
