import Script from 'next/script'
import { Event, Band } from '@/lib/db'
import { getBaseUrl } from '@/lib/seo'

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
  const eventInfo = event.info as { [key: string]: unknown } | null

  // Build start date/time
  const eventDate = new Date(event.date)
  const startDate = eventDate.toISOString()

  // Build location
  const location = {
    '@type': 'Place',
    name: event.location,
    address: {
      '@type': 'PostalAddress',
      addressLocality: event.location,
    },
  }

  // Build performers
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

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    description:
      (eventInfo?.description as string | undefined) ||
      `${event.name} - Battle of the Tech Bands event`,
    startDate,
    location,
    organizer: {
      '@type': 'Organization',
      name: 'Battle of the Tech Bands',
      url: baseUrl,
    },
    ...(performers.length > 0 && { performer: performers }),
    ...(heroImageUrl && {
      image: heroImageUrl,
    }),
    url: `${baseUrl}/event/${event.id}`,
    eventStatus:
      event.status === 'finalized'
        ? 'https://schema.org/EventScheduled'
        : event.status === 'voting'
          ? 'https://schema.org/EventScheduled'
          : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  }

  // Using Next.js Script component with id prevents hydration mismatch
  // when browser extensions (like PostHog) inject scripts before React hydrates
  return (
    <Script
      id={`event-jsonld-${event.id}`}
      type="application/ld+json"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
