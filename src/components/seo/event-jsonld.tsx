import { Event, Band } from '@/lib/db'
import { getBaseUrl } from '@/lib/seo'
import { stripMarkdown } from '@/lib/markdown'

// Default event image if none provided
const DEFAULT_EVENT_IMAGE =
  'https://www.battleofthetechbands.com/images/logos/bottb-dark-square.png'

interface EventJsonLdProps {
  event: Event
  bands?: Band[]
  heroImageUrl?: string
}

export function EventJsonLd({
  event,
  bands = [],
  heroImageUrl,
}: EventJsonLdProps) {
  const baseUrl = getBaseUrl()
  const eventInfo = event.info

  // Build start date/time
  const eventDate = new Date(event.date)
  const startDate = eventDate.toISOString()

  // Build end date - set to 11:59 PM local time on the day of the event
  // This is best practice for concert/show events as it represents when the event day ends
  const tz = event.timezone || 'UTC'

  // Get the date in the event's timezone (YYYY-MM-DD format)
  const localDateStr = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
  }).format(eventDate)

  // Calculate timezone offset by comparing UTC midnight with timezone midnight
  // Create a date at midnight UTC on the local date
  const midnightUtc = new Date(`${localDateStr}T00:00:00Z`)

  // See what time midnight UTC appears as in the timezone
  const midnightInTz = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(midnightUtc)

  const [offsetHours] = midnightInTz.split(':').map(Number)

  // 23:59:59 in timezone = (23 - offsetHours):59:59 UTC on the same date
  // Handle day rollover if needed
  let utcHour = 23 - offsetHours
  let endDateStr = localDateStr

  if (utcHour < 0) {
    // Previous day
    utcHour += 24
    const prevDay = new Date(midnightUtc)
    prevDay.setUTCDate(prevDay.getUTCDate() - 1)
    endDateStr = prevDay.toISOString().split('T')[0]
  } else if (utcHour >= 24) {
    // Next day
    utcHour -= 24
    const nextDay = new Date(midnightUtc)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)
    endDateStr = nextDay.toISOString().split('T')[0]
  }

  const endDate = `${endDateStr}T${String(utcHour).padStart(2, '0')}:59:59.000Z`

  // City and state come from the event's IANA timezone, which every event row
  // carries, rather than from matching words in its name. The name-matching
  // version special-cased Brisbane and Sydney and silently fell through to
  // "Sydney, NSW 2000" for anything else — which put Melbourne in New South
  // Wales the moment that event existed.
  const cityByTimezone: Record<string, { locality: string; region: string }> = {
    'Australia/Brisbane': { locality: 'Brisbane', region: 'QLD' },
    'Australia/Sydney': { locality: 'Sydney', region: 'NSW' },
    'Australia/Melbourne': { locality: 'Melbourne', region: 'VIC' },
  }
  const city = cityByTimezone[event.timezone]

  // No postalCode: the previous 4000/2000 values were the CBD's, not the
  // venue's (The Triffid is Newstead 4006). An omitted field is better than a
  // confidently wrong one, and Google does not require it.
  const location = {
    '@type': 'Place',
    name: event.location,
    address: {
      '@type': 'PostalAddress',
      name: event.location,
      streetAddress: eventInfo?.venue_info || event.location,
      ...(city && {
        addressLocality: city.locality,
        addressRegion: city.region,
      }),
      addressCountry: 'AU',
    },
  }

  // Build performers from bands
  const performers = bands.map((band) => ({
    '@type': 'MusicGroup',
    name: band.name,
    ...(band.company_name && {
      memberOf: {
        '@type': 'Organization',
        name: band.company_name,
      },
    }),
  }))

  // Get image URL with fallback
  const imageUrl =
    heroImageUrl ||
    eventInfo?.image_url ||
    event.image_url ||
    DEFAULT_EVENT_IMAGE

  // Build offers (ticket information) - only for upcoming/voting events
  // For finalized events, don't include offers since the event has already happened
  const ticketUrl = eventInfo?.ticket_url
  const offers =
    event.status !== 'finalized'
      ? {
          '@type': 'Offer',
          url: ticketUrl || `${baseUrl}/event/${event.id}`,
          availability: 'https://schema.org/InStock',
          validFrom: new Date(event.created_at).toISOString(),
          price: '0',
          priceCurrency: 'AUD',
        }
      : undefined

  // Determine event status
  const eventStatus =
    event.status === 'finalized'
      ? 'https://schema.org/EventScheduled'
      : event.status === 'voting'
        ? 'https://schema.org/EventScheduled'
        : 'https://schema.org/EventScheduled'

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'MusicEvent',
    // Link to Wikidata "battle of the bands" concept for better entity recognition
    additionalType: 'https://www.wikidata.org/wiki/Q798766',
    name: event.name,
    description: eventInfo?.description
      ? stripMarkdown(eventInfo.description as string)
      : `${event.name} - Battle of the Tech Bands brings together technology professionals for an unforgettable night of rock, competition, and charity supporting Youngcare.`,
    startDate,
    endDate,
    location,
    // Reference the Organization node from OrganizationJsonLd rather than
    // repeating it, so both resolve to one entity in the graph.
    organizer: {
      '@type': 'Organization',
      '@id': `${baseUrl}/#organization`,
      name: 'Battle of the Tech Bands',
      url: baseUrl,
    },
    performer:
      performers.length > 0
        ? performers
        : [
            {
              '@type': 'MusicGroup',
              name: 'Battle of the Tech Bands Performers',
            },
          ],
    image: imageUrl,
    url: `${baseUrl}/event/${event.id}`,
    eventStatus,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    ...(offers && { offers }),
  }

  // Use a regular script tag per Next.js docs recommendation
  // This ensures JSON-LD is rendered in initial HTML for search engines
  return (
    <script
      id={`event-jsonld-${event.id}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, '\\u003c'),
      }}
    />
  )
}
