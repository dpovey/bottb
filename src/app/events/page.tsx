import type { Metadata } from 'next'
import {
  getActiveEvent,
  getUpcomingEvents,
  getPastEvents,
  getBandScores,
  getBandsForEvent,
  getPhotosByLabel,
  hasFinalizedResults,
  getFinalizedResults,
  PHOTO_LABELS,
} from '@/lib/db'
import { getNavEvents } from '@/lib/nav-data'
import { PublicLayout } from '@/components/layouts'
import { EventCard } from '@/components/event-card'
import { PageHeader } from '@/components/hero'
import {
  parseScoringVersion,
  hasDetailedBreakdown,
  calculateTotalScore,
  type BandScoreData,
} from '@/lib/scoring'
import { getBaseUrl } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl()
  const upcomingEvents = await getUpcomingEvents()
  const pastEvents = await getPastEvents()
  const totalEvents = upcomingEvents.length + pastEvents.length

  const description =
    totalEvents > 0
      ? `Browse ${totalEvents} Battle of the Tech Bands events - past, present, and upcoming. See results, winners, and event details.`
      : 'Browse all Battle of the Tech Bands events - past, present, and upcoming. See results, winners, and event details.'

  return {
    title: 'Events | Battle of the Tech Bands',
    description,
    alternates: {
      canonical: `${baseUrl}/events`,
    },
    openGraph: {
      title: 'Events | Battle of the Tech Bands',
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: 'Events | Battle of the Tech Bands',
      description,
    },
  }
}

interface BandScore {
  id: string
  name: string
  order: number
  avg_song_choice: number
  avg_performance: number
  avg_crowd_vibe: number
  avg_visuals?: number
  avg_crowd_vote: number
  crowd_vote_count: number
  judge_vote_count: number
  total_crowd_votes: number
  crowd_score?: number
}

interface EventInfo {
  scoring_version?: string
  winner?: string
  [key: string]: unknown
}

// Use ISR with 5-minute revalidation for performance
// Events are activated/finalized manually, so 5 minutes is sufficient
export const revalidate = 300

function getRelativeDate(dateString: string): string {
  const now = new Date()
  const eventDate = new Date(dateString)
  const diffTime = eventDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  const absDays = Math.abs(diffDays)

  if (diffDays === 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Tomorrow'
  } else if (diffDays > 1) {
    if (diffDays >= 365) {
      const years = Math.floor(diffDays / 365)
      return years === 1 ? 'In 1 year' : `In ${years} years`
    } else if (diffDays >= 30) {
      const months = Math.floor(diffDays / 30)
      return months === 1 ? 'In 1 month' : `In ${months} months`
    }
    return `In ${diffDays} days`
  } else if (diffDays === -1) {
    return 'Yesterday'
  } else {
    // Past dates
    if (absDays >= 365) {
      const years = Math.floor(absDays / 365)
      return years === 1 ? '1 year ago' : `${years} years ago`
    } else if (absDays >= 30) {
      const months = Math.floor(absDays / 30)
      return months === 1 ? '1 month ago' : `${months} months ago`
    }
    return `${absDays} days ago`
  }
}

export default async function EventsPage() {
  const [activeEvent, upcomingEvents, pastEvents, navEvents] =
    await Promise.all([
      getActiveEvent(),
      getUpcomingEvents(),
      getPastEvents(),
      getNavEvents(),
    ])

  // Get upcoming events with bands and hero photos
  const upcomingEventsWithBands = await Promise.all(
    upcomingEvents.map(async (event) => {
      const [bands, heroPhotos] = await Promise.all([
        getBandsForEvent(event.id),
        getPhotosByLabel(PHOTO_LABELS.EVENT_HERO, { eventId: event.id }),
      ])
      const heroPhoto = heroPhotos.length > 0 ? heroPhotos[0] : null
      return { ...event, bands, heroPhoto }
    })
  )

  // Get past events with winners, bands, and hero photos
  const pastEventsWithWinners = await Promise.all(
    pastEvents.map(async (event) => {
      const [bands, heroPhotos] = await Promise.all([
        getBandsForEvent(event.id),
        getPhotosByLabel(PHOTO_LABELS.EVENT_HERO, { eventId: event.id }),
      ])
      const heroPhoto = heroPhotos.length > 0 ? heroPhotos[0] : null
      const eventInfo = event.info as EventInfo | null
      const scoringVersion = parseScoringVersion(eventInfo)
      const showDetailedScoring = hasDetailedBreakdown(scoringVersion)

      // For 2022.1 events, use the stored winner name
      if (!showDetailedScoring) {
        const storedWinner = eventInfo?.winner
        if (storedWinner) {
          return {
            ...event,
            overallWinner: { name: storedWinner, totalScore: 0 },
            bands,
            scoringVersion,
            heroPhoto,
          }
        }
        return {
          ...event,
          overallWinner: null,
          bands,
          scoringVersion,
          heroPhoto,
        }
      }

      // For 2025.1 and 2026.1, check if event is finalized and use finalized results
      const isFinalized = event.status === 'finalized'
      if (isFinalized && (await hasFinalizedResults(event.id))) {
        // Use finalized results from table (already sorted by final_rank)
        const finalizedResults = await getFinalizedResults(event.id)
        const overallWinner =
          finalizedResults.length > 0
            ? {
                name: finalizedResults[0].band_name,
                totalScore: Number(finalizedResults[0].total_score || 0),
              }
            : null
        return { ...event, overallWinner, bands, scoringVersion, heroPhoto }
      }

      // Only calculate scores for non-finalized past events
      const scores = (await getBandScores(event.id)) as BandScore[]

      const bandResults = scores
        .map((score) => {
          const scoreData: BandScoreData = {
            avg_song_choice: score.avg_song_choice,
            avg_performance: score.avg_performance,
            avg_crowd_vibe: score.avg_crowd_vibe,
            avg_visuals: score.avg_visuals,
            crowd_vote_count: score.crowd_vote_count,
            total_crowd_votes: score.total_crowd_votes,
            crowd_score: score.crowd_score,
          }

          const totalScore = calculateTotalScore(
            scoreData,
            scoringVersion,
            scores.map((s) => ({
              avg_song_choice: s.avg_song_choice,
              avg_performance: s.avg_performance,
              avg_crowd_vibe: s.avg_crowd_vibe,
              avg_visuals: s.avg_visuals,
              crowd_vote_count: s.crowd_vote_count,
              total_crowd_votes: s.total_crowd_votes,
              crowd_score: s.crowd_score,
            }))
          )

          return { ...score, totalScore }
        })
        .sort((a, b) => b.totalScore - a.totalScore)

      const overallWinner = bandResults.length > 0 ? bandResults[0] : null
      return { ...event, overallWinner, bands, scoringVersion, heroPhoto }
    })
  )

  const totalEvents =
    (activeEvent ? 1 : 0) +
    upcomingEventsWithBands.length +
    pastEventsWithWinners.length

  return (
    <PublicLayout
      footerVariant="simple"
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Events' }]}
      navEvents={navEvents}
    >
      {/* Page Header */}
      <PageHeader
        title="Events"
        subtitle={`Browse ${totalEvents} Battle of the Tech Bands event${
          totalEvents !== 1 ? 's' : ''
        }`}
      />

      {/* Active Event Section */}
      {activeEvent && (
        <section className="py-12 bg-bg">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="mb-8">
              <h2 className="text-sm tracking-widest uppercase text-accent mb-2">
                Happening Now
              </h2>
              <p className="text-text-muted">
                Cast your vote and support your favorite band
              </p>
            </div>

            <EventCard
              event={activeEvent}
              relativeDate="Live Now"
              bands={[]}
              variant="active"
            />
          </div>
        </section>
      )}

      {/* Upcoming Events Section */}
      {upcomingEventsWithBands.length > 0 && (
        <section className="py-12 bg-bg-muted">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-2">
                Upcoming Events
              </h2>
              <p className="text-text-muted">
                {upcomingEventsWithBands.length} event
                {upcomingEventsWithBands.length !== 1 ? 's' : ''} coming up
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingEventsWithBands.map((event) => {
                const relativeDate = getRelativeDate(event.date)
                return (
                  <EventCard
                    key={event.id}
                    event={event}
                    relativeDate={relativeDate}
                    bands={event.bands}
                    variant="upcoming"
                    heroPhoto={event.heroPhoto}
                    visual
                  />
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Past Events Section */}
      {pastEventsWithWinners.length > 0 && (
        <section className="py-12 bg-bg-elevated">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-2">
                Past Events
              </h2>
              <p className="text-text-muted">
                {pastEventsWithWinners.length} event
                {pastEventsWithWinners.length !== 1 ? 's' : ''} in the archives
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastEventsWithWinners.map((event) => {
                const relativeDate = getRelativeDate(event.date)
                return (
                  <EventCard
                    key={event.id}
                    event={event}
                    relativeDate={relativeDate}
                    variant="past"
                    showWinner={!!event.overallWinner}
                    winner={event.overallWinner || undefined}
                    bands={event.bands}
                    heroPhoto={event.heroPhoto}
                    visual
                  />
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Empty state */}
      {totalEvents === 0 && (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
            <p className="text-text-muted text-lg">
              No events found. Check back soon!
            </p>
          </div>
        </section>
      )}
    </PublicLayout>
  )
}
