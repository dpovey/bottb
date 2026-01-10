import type { Metadata } from 'next'
import {
  getEventById,
  getBandsForEvent,
  getPhotosByLabel,
  getVideos,
  hasFinalizedResults,
  getFinalizedResults,
  PHOTO_LABELS,
} from '@/lib/db'
import { getNavEvents } from '@/lib/nav-data'
import { formatEventDate } from '@/lib/date-utils'
import { parseScoringVersion, hasDetailedBreakdown } from '@/lib/scoring'
import { getBaseUrl } from '@/lib/seo'
import { EventPageClient, type OverallWinner } from './event-page-client'
import { EventJsonLd } from '@/components/seo'
import { notFound } from 'next/navigation'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>
}): Promise<Metadata> {
  const { eventId } = await params
  const baseUrl = getBaseUrl()
  const event = await getEventById(eventId)

  if (!event) {
    return {
      title: 'Event Not Found | Battle of the Tech Bands',
    }
  }

  const eventInfo = event.info as { [key: string]: unknown } | null
  const scoringVersion = parseScoringVersion(eventInfo)
  const showDetailedBreakdown = hasDetailedBreakdown(scoringVersion)
  const storedWinner = eventInfo?.winner as string | undefined
  const isFinalized = event.status === 'finalized'
  const show2022Winner = isFinalized && !showDetailedBreakdown && storedWinner

  // Get bands count
  const bands = await getBandsForEvent(eventId)
  const bandCount = bands.length

  // Build title
  let title = event.name
  if (show2022Winner) {
    title += ` - ${storedWinner} Wins`
  }
  title += ' | Battle of the Tech Bands'

  // Build description
  let description = `${event.name} - ${formatEventDate(event.date, event.timezone)} at ${event.location}`
  if (bandCount > 0) {
    description += `. ${bandCount} band${bandCount !== 1 ? 's' : ''} ${isFinalized ? 'competed' : 'performing'}`
  }
  if (event.info?.description) {
    description += `. ${event.info.description}`
  }
  if (show2022Winner) {
    description += `. Winner: ${storedWinner}`
  }

  // Get event hero image
  const eventHeroPhotos = await getPhotosByLabel(PHOTO_LABELS.EVENT_HERO, {
    eventId,
  })
  const heroPhoto = eventHeroPhotos.length > 0 ? eventHeroPhotos[0] : null
  const ogImage =
    heroPhoto?.blob_url || (event.info?.image_url as string | undefined)

  return {
    title,
    description,
    alternates: {
      canonical: `${baseUrl}/event/${eventId}`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      images: ogImage
        ? [
            {
              url: ogImage,
              width: 1200,
              height: 630,
              alt: `${event.name} - Battle of the Tech Bands`,
            },
          ]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  }
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params

  // Fetch all data in parallel
  const [event, bands, eventHeroPhotos, videos, shorts, navEvents] =
    await Promise.all([
      getEventById(eventId),
      getBandsForEvent(eventId),
      getPhotosByLabel(PHOTO_LABELS.EVENT_HERO, { eventId }),
      getVideos({ eventId, videoType: 'video' }),
      getVideos({ eventId, videoType: 'short' }),
      getNavEvents(),
    ])

  if (!event) {
    notFound()
  }

  // Use first hero photo for OG image, pass all for carousel
  const primaryHeroPhoto =
    eventHeroPhotos.length > 0 ? eventHeroPhotos[0] : null

  // Fetch winner data for finalized events with detailed scoring
  let overallWinner: OverallWinner | undefined
  const eventInfo = event.info as {
    scoring_version?: string
    winner?: string
  } | null
  const scoringVersion = parseScoringVersion(eventInfo)
  const showDetailedBreakdown = hasDetailedBreakdown(scoringVersion)
  const isFinalized = event.status === 'finalized'

  if (isFinalized) {
    if (!showDetailedBreakdown && eventInfo?.winner) {
      // 2022.1 events: use stored winner name
      const winnerBand = bands.find(
        (b) => b.name.toLowerCase() === eventInfo.winner?.toLowerCase()
      )
      overallWinner = {
        name: eventInfo.winner,
        companySlug: winnerBand?.company_slug,
        companyName: winnerBand?.company_name,
        companyIconUrl: winnerBand?.company_icon_url,
      }
    } else if (showDetailedBreakdown && (await hasFinalizedResults(eventId))) {
      // 2025.1/2026.1 events: fetch from finalized_results table
      const finalizedResults = await getFinalizedResults(eventId)
      if (finalizedResults.length > 0) {
        const winner = finalizedResults[0]
        const winnerBand = bands.find((b) => b.id === winner.band_id)
        overallWinner = {
          name: winner.band_name,
          totalScore: Number(winner.total_score || 0),
          companySlug: winnerBand?.company_slug,
          companyName: winnerBand?.company_name,
          companyIconUrl: winnerBand?.company_icon_url,
        }
      }
    }
  }

  return (
    <>
      <EventJsonLd
        event={event}
        bands={bands}
        heroImageUrl={
          primaryHeroPhoto?.blob_url ||
          (event.info?.image_url as string | undefined)
        }
      />
      <EventPageClient
        event={event}
        bands={bands}
        heroPhotos={eventHeroPhotos}
        videos={videos}
        shorts={shorts}
        navEvents={navEvents}
        overallWinner={overallWinner}
      />
    </>
  )
}
