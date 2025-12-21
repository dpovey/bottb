import Script from 'next/script'
import { Band } from '@/lib/db'
import { getBaseUrl } from '@/lib/seo'

interface MusicGroupJsonLdProps {
  band: Band
  eventName: string
  eventDate: string
  eventLocation: string
}

export function MusicGroupJsonLd({
  band,
  eventName,
  eventDate,
  eventLocation,
}: MusicGroupJsonLdProps) {
  const baseUrl = getBaseUrl()
  const bandInfo = band.info as { [key: string]: unknown } | null

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: band.name,
    description: band.description || `${band.name} performing at ${eventName}`,
    url: `${baseUrl}/band/${band.id}`,
    // Event participation
    event: {
      '@type': 'Event',
      name: eventName,
      startDate: new Date(eventDate).toISOString(),
      location: {
        '@type': 'Place',
        name: eventLocation,
      },
    },
  }

  if (band.company_name) {
    schema.memberOf = {
      '@type': 'Organization',
      name: band.company_name,
      ...(band.company_slug && {
        url: `${baseUrl}/companies/${band.company_slug}`,
      }),
    }
  }

  if (bandInfo?.members && Array.isArray(bandInfo.members)) {
    schema.member = (bandInfo.members as string[]).map((member) => ({
      '@type': 'Person',
      name: member,
    }))
  }

  if (bandInfo?.genre) {
    schema.genre = bandInfo.genre
  }

  return (
    <Script
      id={`music-group-jsonld-${band.id}`}
      type="application/ld+json"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
