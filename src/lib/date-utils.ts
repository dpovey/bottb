/**
 * Formats a date string to a readable format like "23rd October 2025 @ 6:30PM"
 */
export function formatEventDate(dateString: string): string {
  const date = new Date(dateString);

  // Get day with ordinal suffix
  const day = date.getDate();
  const dayWithOrdinal = day + getOrdinalSuffix(day);

  // Get month name
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
  const monthName = monthNames[date.getMonth()];

  // Get year
  const year = date.getFullYear();

  // Get time in 12-hour format
  const hours = date.getHours();
  const minutes = date.getMinutes();
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
