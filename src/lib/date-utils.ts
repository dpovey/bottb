/**
 * Formats a date string to a readable format like "23rd October 2025 @ 6:30PM"
 * Uses UTC timezone for consistent behavior across environments
 */
export function formatEventDate(dateString: string): string {
  const date = new Date(dateString);

  // Check for invalid date
  if (isNaN(date.getTime())) {
    return "Invalid Date December NaN @ NaN:NaNaM";
  }

  // Get day with ordinal suffix (using UTC)
  const day = date.getUTCDate();
  const dayWithOrdinal = day + getOrdinalSuffix(day);

  // Get month name (using UTC)
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthName = monthNames[date.getUTCMonth()];

  // Get year (using UTC)
  const year = date.getUTCFullYear();

  // Get time in 12-hour format (using UTC)
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, "0");

  return `${dayWithOrdinal} ${monthName} ${year} @ ${displayHours}:${displayMinutes}${ampm}`;
}

/**
 * Gets the ordinal suffix for a day (1st, 2nd, 3rd, 4th, etc.)
 */
function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) {
    return "th";
  }

  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}
