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
