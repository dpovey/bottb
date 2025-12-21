import { Event, Band } from '@/lib/db'
import { getBaseUrl } from '@/lib/seo'

// Default event image if none provided
const DEFAULT_EVENT_IMAGE =
  'https://www.battleofthetechbands.com/images/logos/bottb-dark-square.png'

// Estimate event duration in hours (typical concert)
const EVENT_DURATION_HOURS = 4

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

  // Build end date (estimate based on typical event duration)
  const endDate = new Date(
    eventDate.getTime() + EVENT_DURATION_HOURS * 60 * 60 * 1000
  ).toISOString()

  // Determine city and country from event name/location for better address data
  const isBrisbane = event.name.toLowerCase().includes('brisbane')
  const isSydney = event.name.toLowerCase().includes('sydney')

  // Build location with full address details
  const location = {
    '@type': 'Place',
    name: event.location,
    address: {
      '@type': 'PostalAddress',
      name: event.location,
      streetAddress: eventInfo?.venue_info || event.location,
      addressLocality: isBrisbane ? 'Brisbane' : isSydney ? 'Sydney' : 'Sydney',
      addressRegion: isBrisbane ? 'QLD' : 'NSW',
      postalCode: isBrisbane ? '4000' : '2000',
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

  // Build offers (ticket information)
  const ticketUrl = eventInfo?.ticket_url
  const offers = {
    '@type': 'Offer',
    url: ticketUrl || `${baseUrl}/event/${event.id}`,
    availability:
      event.status === 'upcoming'
        ? 'https://schema.org/InStock'
        : 'https://schema.org/SoldOut',
    validFrom: new Date(event.created_at).toISOString(),
  }

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
    name: event.name,
    description:
      eventInfo?.description ||
      `${event.name} - Battle of the Tech Bands brings together technology professionals for an unforgettable night of rock, competition, and charity supporting Youngcare.`,
    startDate,
    endDate,
    location,
    organizer: {
      '@type': 'Organization',
      name: 'Battle of the Tech Bands',
      url: baseUrl,
      logo: `${baseUrl}/images/logos/bottb-dark-square.png`,
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
    offers,
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
