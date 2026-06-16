/**
 * Formats a date string to a readable format like "23rd October 2025 @ 6:30PM"
 * Displays the date in the specified timezone (IANA timezone name)
 * Falls back to UTC if no timezone is specified
 */
export function formatEventDate(dateString: string, timezone?: string): string {
  const date = new Date(dateString)

  // Check for invalid date
  if (isNaN(date.getTime())) {
    return 'Invalid Date December NaN @ NaN:NaNaM'
  }

  // Use Intl.DateTimeFormat to get date parts in the specified timezone
  const tz = timezone || 'UTC'

  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    timeZone: tz,
  })
  const monthFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    timeZone: tz,
  })
  const yearFormatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    timeZone: tz,
  })
  const hourFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: tz,
  })
  const minuteFormatter = new Intl.DateTimeFormat('en-US', {
    minute: 'numeric',
    timeZone: tz,
  })

  const day = parseInt(dayFormatter.format(date), 10)
  const dayWithOrdinal = day + getOrdinalSuffix(day)
  const monthName = monthFormatter.format(date)
  const year = yearFormatter.format(date)

  // Get hours and minutes in the timezone
  // For UTC, use UTC methods directly for more reliable behavior
  let hours: number
  let minutesNum: number
  if (tz === 'UTC') {
    hours = date.getUTCHours()
    minutesNum = date.getUTCMinutes()
  } else {
    hours = parseInt(hourFormatter.format(date), 10)
    minutesNum = parseInt(minuteFormatter.format(date), 10)
  }
  const minutes = minutesNum.toString().padStart(2, '0')

  const ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12

  return `${dayWithOrdinal} ${monthName} ${year} @ ${displayHours}:${minutes}${ampm}`
}

/**
 * Tentative-date metadata carried on `event.info`. See `Event.info` in
 * `db-types.ts` for the full contract.
 */
export interface TentativeDateInfo {
  date_tbc?: boolean
  date_display?: string
}

/**
 * Display label for an event's date, honouring a tentative ("TBC") date.
 *
 * When `info.date_tbc` is set, returns the human-authored `date_display`
 * (e.g. "October 2026") rather than the precise day/time — the stored
 * `date` is only a best estimate in that case and shouldn't be shown as
 * if it were confirmed. Otherwise falls back to the full formatted date.
 */
export function formatEventDateLabel(
  dateString: string,
  timezone?: string,
  info?: TentativeDateInfo | null
): string {
  if (info?.date_tbc) {
    return info.date_display || 'Date to be confirmed'
  }
  return formatEventDate(dateString, timezone)
}

/**
 * Gets the ordinal suffix for a day (1st, 2nd, 3rd, 4th, etc.)
 */
function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) {
    return 'th'
  }

  switch (day % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}

/**
 * Returns an urgency-focused countdown for an upcoming event, or null if
 * the event date has already passed.
 *
 *   today    → "Tonight"
 *   1 day    → "Tomorrow"
 *   2-6 days → "{N} days left"
 *   1 week   → "1 week left"
 *   2+ weeks → "{N} weeks left"   (Math.floor of days / 7)
 *   past     → null
 *
 * Date math runs in the event's timezone using calendar-day boundaries —
 * an event "tomorrow" in Melbourne reads as "Tomorrow" for a viewer in
 * any timezone, not "Today" for someone several hours later in UTC.
 */
export function getEventCountdown(
  dateString: string | Date,
  timezone?: string,
  now: Date = new Date()
): string | null {
  const eventDate =
    typeof dateString === 'string' ? new Date(dateString) : dateString
  if (isNaN(eventDate.getTime())) return null

  // Build a formatter we can pull year/month/day parts from. Fall back to UTC
  // if a caller passes an invalid IANA name — Intl.DateTimeFormat throws on
  // bad timezones and we'd rather degrade than crash a render.
  let dayFmt: Intl.DateTimeFormat
  try {
    dayFmt = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: timezone || 'UTC',
    })
  } catch {
    dayFmt = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC',
    })
  }

  const midnightUtcInTz = (d: Date) => {
    const parts = dayFmt.formatToParts(d)
    const year = parts.find((p) => p.type === 'year')?.value
    const month = parts.find((p) => p.type === 'month')?.value
    const day = parts.find((p) => p.type === 'day')?.value
    return new Date(`${year}-${month}-${day}T00:00:00Z`)
  }

  const todayMidnightUtc = midnightUtcInTz(now)
  const eventMidnightUtc = midnightUtcInTz(eventDate)

  const diffDays = Math.round(
    (eventMidnightUtc.getTime() - todayMidnightUtc.getTime()) /
      (1000 * 60 * 60 * 24)
  )

  if (diffDays < 0) return null
  if (diffDays === 0) return 'Tonight'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays < 7) return `${diffDays} days left`
  const weeks = Math.floor(diffDays / 7)
  return weeks === 1 ? '1 week left' : `${weeks} weeks left`
}

/**
 * Gets date parts (day, month, year) in a specific timezone
 * Useful for DateBadge component
 */
export function getDatePartsInTimezone(
  dateString: string | Date,
  timezone?: string
): { day: number; month: string; year: number } {
  const date =
    typeof dateString === 'string' ? new Date(dateString) : dateString
  const tz = timezone || 'UTC'

  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    timeZone: tz,
  })
  const monthFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: tz,
  })
  const yearFormatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    timeZone: tz,
  })

  return {
    day: parseInt(dayFormatter.format(date), 10),
    month: monthFormatter.format(date).toUpperCase(),
    year: parseInt(yearFormatter.format(date), 10),
  }
}
