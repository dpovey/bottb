import type { Metadata } from 'next'
import {
  getEventById,
  getBandsForEvent,
  getBandScores,
  hasFinalizedResults,
  getFinalizedResults,
  getPhotosByLabel,
  PHOTO_LABELS,
} from '@/lib/db'
import { getNavEvents } from '@/lib/nav-data'
import { notFound, redirect } from 'next/navigation'
import { formatEventDate } from '@/lib/date-utils'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import { WebLayout } from '@/components/layouts'
import { Card, Button, BandThumbnail } from '@/components/ui'
import { PhotoStrip } from '@/components/photos/photo-strip'
import {
  WinnerDisplay,
  CategoryWinners,
  ScoreBreakdown,
  ShareResults,
  type CategoryWinnerData,
  type BandResultData,
} from '@/components/scoring'
import {
  parseScoringVersion,
  hasDetailedBreakdown,
  calculateTotalScore,
  getCategories,
  type BandScoreData,
} from '@/lib/scoring'
import { getBaseUrl } from '@/lib/seo'
import { EventJsonLd } from '@/components/seo'

interface BandScore {
  id: string
  name: string
  order: number
  hero_thumbnail_url?: string
  hero_focal_point?: { x: number; y: number }
  info?: {
    logo_url?: string
    website?: string
    social_media?: {
      twitter?: string
      instagram?: string
      facebook?: string
    }
    genre?: string
    members?: string[]
    [key: string]: unknown
  }
  avg_song_choice: number
  avg_performance: number
  avg_crowd_vibe: number
  avg_visuals?: number
  avg_crowd_vote: number
  crowd_vote_count: number
  judge_vote_count: number
  total_crowd_votes: number
  crowd_noise_energy?: number
  crowd_noise_peak?: number
  crowd_score?: number
  description?: string
  company_slug?: string
  company_name?: string
  company_icon_url?: string
}

interface EventInfo {
  scoring_version?: string
  winner?: string // Legacy: band name (deprecated)
  winner_band_id?: string // Preferred: band ID
  [key: string]: unknown
}

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

  const eventInfo = event.info as EventInfo | null
  const scoringVersion = parseScoringVersion(eventInfo)
  const showDetailedBreakdown = hasDetailedBreakdown(scoringVersion)

  // Get winner information
  let winnerName = ''
  if (!showDetailedBreakdown) {
    winnerName = eventInfo?.winner || ''
  } else {
    if (event.status === 'finalized' && (await hasFinalizedResults(eventId))) {
      const finalizedResults = await getFinalizedResults(eventId)
      if (finalizedResults.length > 0) {
        winnerName = finalizedResults[0].band_name
      }
    } else {
      const scores = (await getBandScores(eventId)) as BandScore[]
      if (scores.length > 0) {
        const sortedScores = scores
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
            return {
              ...score,
              totalScore: calculateTotalScore(
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
              ),
            }
          })
          .sort((a, b) => b.totalScore - a.totalScore)
        winnerName = sortedScores[0]?.name || ''
      }
    }
  }

  // Build title and description
  const title = winnerName
    ? `${winnerName} Wins ${event.name} | Battle of the Tech Bands`
    : `${event.name} Results | Battle of the Tech Bands`

  let description = `Results for ${event.name}`
  if (winnerName) {
    description += `. Winner: ${winnerName}`
  }
  description += `. ${formatEventDate(event.date, event.timezone)} • ${event.location}`

  // Get event hero image
  const eventHeroPhotos = await getPhotosByLabel(PHOTO_LABELS.EVENT_HERO, {
    eventId,
  })
  const heroPhoto = eventHeroPhotos.length > 0 ? eventHeroPhotos[0] : null
  const ogImage = heroPhoto?.blob_url || event.info?.image_url || undefined

  return {
    title,
    description,
    alternates: {
      canonical: `${baseUrl}/results/${eventId}`,
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
              alt: `${event.name} Results`,
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

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  const baseUrl = getBaseUrl()
  const [session, event, navEvents] = await Promise.all([
    auth(),
    getEventById(eventId),
    getNavEvents(),
  ])
  const isAdmin = session?.user?.isAdmin || false

  if (!event) {
    notFound()
  }

  if (event.status !== 'finalized' && !isAdmin) {
    redirect(`/vote/crowd/${eventId}`)
  }

  const eventInfo = event.info as EventInfo | null
  const scoringVersion = parseScoringVersion(eventInfo)
  const showDetailedBreakdown = hasDetailedBreakdown(scoringVersion)

  // Fetch bands and hero photos - needed for both legacy and modern results
  const [bands, eventHeroPhotos] = await Promise.all([
    getBandsForEvent(eventId),
    getPhotosByLabel(PHOTO_LABELS.EVENT_HERO, { eventId }),
  ])
  const heroPhoto = eventHeroPhotos.length > 0 ? eventHeroPhotos[0] : null

  const breadcrumbs = [
    { label: 'Events', href: '/' },
    { label: event.name, href: `/event/${eventId}` },
    { label: 'Results' },
  ]

  // For 2022.1 events - just show the stored winner
  if (!showDetailedBreakdown) {
    // Prefer winner_band_id, fall back to legacy winner name field
    const winnerBandId = eventInfo?.winner_band_id
    const legacyWinnerName = eventInfo?.winner

    // Find the winning band - by ID first (preferred), then by name (legacy, case-insensitive)
    const winnerBand = winnerBandId
      ? bands.find((band) => band.id === winnerBandId)
      : legacyWinnerName
        ? bands.find(
            (band) => band.name.toLowerCase() === legacyWinnerName.toLowerCase()
          )
        : undefined

    // Use the band's actual name if found, otherwise use the legacy value
    const winnerName =
      winnerBand?.name || legacyWinnerName || 'Winner to be announced'

    return (
      <>
        <EventJsonLd
          event={event}
          bands={bands}
          heroImageUrl={
            heroPhoto?.blob_url || (event.info?.image_url as string | undefined)
          }
        />
        <WebLayout breadcrumbs={breadcrumbs} navEvents={navEvents}>
          {/* Page Header */}
          <section className="py-12 border-b border-white/5">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
              <h1 className="text-sm tracking-widest uppercase text-text-muted mb-3">
                Battle Results
              </h1>
              <h2 className="text-3xl lg:text-4xl font-semibold text-white mb-2">
                {event.name}
              </h2>
              <p className="text-text-muted">
                {formatEventDate(event.date, event.timezone)} • {event.location}
              </p>
            </div>
          </section>

          {/* Overall Winner */}
          <section className="py-12">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <WinnerDisplay
                winnerName={winnerName}
                companySlug={winnerBand?.company_slug}
                companyName={winnerBand?.company_name}
                companyIconUrl={winnerBand?.company_icon_url}
                logoUrl={winnerBand?.info?.logo_url}
                heroThumbnailUrl={winnerBand?.hero_thumbnail_url}
                heroFocalPoint={winnerBand?.hero_focal_point}
                scoringVersion={scoringVersion}
                eventName={event.name}
                eventDate={formatEventDate(event.date, event.timezone)}
                eventLocation={event.location}
              />
              {/* Share buttons */}
              <div className="mt-8">
                <ShareResults
                  eventName={event.name}
                  winnerName={winnerName}
                  eventUrl={`${baseUrl}/results/${eventId}`}
                />
              </div>
            </div>
          </section>

          {/* Participating Bands */}
          {bands.length > 0 && (
            <section className="py-12">
              <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <h3 className="text-sm tracking-widest uppercase text-text-muted mb-6 text-center">
                  Participating Bands
                </h3>
                <div className="flex flex-wrap justify-center gap-3">
                  {bands.map((band) => (
                    <Link key={band.id} href={`/band/${band.id}`}>
                      <span
                        className={`bg-white/5 border text-sm px-4 py-2 rounded-full transition-colors hover:bg-white/10 ${
                          band.name === winnerName
                            ? 'border-warning/30 text-warning'
                            : 'border-white/10 text-white'
                        }`}
                      >
                        {band.name === winnerName && '🏆 '}
                        {band.name}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Photos Section */}
          <PhotoStrip eventId={eventId} />

          {/* Back to Event */}
          <section className="py-8 border-t border-white/5">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 flex justify-center gap-4">
              <Link href={`/event/${eventId}`}>
                <Button variant="outline-solid">Back to Event</Button>
              </Link>
            </div>
          </section>
        </WebLayout>
      </>
    )
  }

  // For 2025.1 and 2026.1 - use finalized results if available, otherwise calculate
  let bandResults: {
    id: string
    name: string
    companySlug?: string
    companyName?: string
    companyIconUrl?: string
    songChoice: number
    performance: number
    crowdVibe: number
    crowdVote: number
    crowdVoteCount: number
    totalCrowdVotes: number
    screamOMeter: number
    visuals: number
    crowdNoiseEnergy?: number | null
    heroThumbnailUrl?: string
    heroFocalPoint?: { x: number; y: number }
    logoUrl?: string
    totalScore: number
    rank: number
  }[] = []

  // Check if event is finalized and has finalized results
  if (event.status === 'finalized' && (await hasFinalizedResults(eventId))) {
    // Use finalized results from table
    const finalizedResults = await getFinalizedResults(eventId)

    // Get band info for additional fields
    const bandMap = new Map(bands.map((b) => [b.id, b]))

    bandResults = finalizedResults.map((result) => {
      const band = bandMap.get(result.band_id)
      // Calculate normalized crowd vote score from stored data
      const maxVoteCount = Math.max(
        ...finalizedResults.map((r) => Number(r.crowd_vote_count || 0))
      )
      const crowdVoteScore =
        maxVoteCount > 0
          ? (Number(result.crowd_vote_count || 0) / maxVoteCount) * 10
          : 0

      return {
        id: result.band_id,
        name: result.band_name,
        companySlug: band?.company_slug,
        companyName: band?.company_name,
        companyIconUrl: band?.company_icon_url,
        songChoice: Number(result.avg_song_choice || 0),
        performance: Number(result.avg_performance || 0),
        crowdVibe: Number(result.avg_crowd_vibe || 0),
        crowdVote: crowdVoteScore,
        crowdVoteCount: result.crowd_vote_count,
        totalCrowdVotes: result.total_crowd_votes,
        screamOMeter: result.crowd_noise_score
          ? Number(result.crowd_noise_score)
          : 0,
        visuals: Number(result.avg_visuals || 0),
        crowdNoiseEnergy: result.crowd_noise_energy,
        heroThumbnailUrl: band?.hero_thumbnail_url,
        heroFocalPoint: band?.hero_focal_point,
        logoUrl: band?.info?.logo_url,
        totalScore: Number(result.total_score || 0),
        rank: result.final_rank,
      }
    })
  } else {
    // Calculate scores dynamically for non-finalized events or admin preview
    const scores = (await getBandScores(eventId)) as BandScore[]

    bandResults = scores
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

        // Calculate crowd vote score (normalized)
        const maxVoteCount = Math.max(
          ...scores.map((s) => Number(s.crowd_vote_count || 0))
        )
        const crowdVoteScore =
          maxVoteCount > 0
            ? (Number(score.crowd_vote_count || 0) / maxVoteCount) * 10
            : 0

        // Calculate total using version-aware function
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

        return {
          id: score.id,
          name: score.name,
          companySlug: score.company_slug,
          companyName: score.company_name,
          companyIconUrl: score.company_icon_url,
          songChoice: Number(score.avg_song_choice || 0),
          performance: Number(score.avg_performance || 0),
          crowdVibe: Number(score.avg_crowd_vibe || 0),
          crowdVote: crowdVoteScore,
          crowdVoteCount: score.crowd_vote_count,
          totalCrowdVotes: score.total_crowd_votes,
          screamOMeter: score.crowd_score ? Number(score.crowd_score) : 0,
          visuals: Number(score.avg_visuals || 0),
          crowdNoiseEnergy: score.crowd_noise_energy,
          heroThumbnailUrl: score.hero_thumbnail_url,
          heroFocalPoint: score.hero_focal_point,
          logoUrl: score.info?.logo_url,
          totalScore,
          rank: 0, // Will be set after sorting
        }
      })
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((result, index) => ({ ...result, rank: index + 1 }))
  }

  // Handle empty results early
  if (bandResults.length === 0) {
    return (
      <WebLayout breadcrumbs={breadcrumbs} navEvents={navEvents}>
        <div className="py-16">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
            <h1 className="text-4xl font-semibold text-white mb-4">Results</h1>
            <p className="text-text-muted mb-8">{event.name}</p>
            <Card className="max-w-md mx-auto py-12">
              <h2 className="text-xl font-semibold text-white mb-2">
                No Results Yet
              </h2>
              <p className="text-text-muted">
                Voting hasn&apos;t started yet or no votes have been submitted.
              </p>
            </Card>
          </div>
        </div>
      </WebLayout>
    )
  }

  // Find category winners
  const categories = getCategories(scoringVersion)
  const categoryWinners: CategoryWinnerData[] = categories.map((category) => {
    let winner: (typeof bandResults)[0] | undefined
    let score = 0

    switch (category.id) {
      case 'song_choice':
        winner = bandResults.reduce((prev, current) =>
          current.songChoice > prev.songChoice ? current : prev
        )
        score = winner?.songChoice || 0
        break
      case 'performance':
        winner = bandResults.reduce((prev, current) =>
          current.performance > prev.performance ? current : prev
        )
        score = winner?.performance || 0
        break
      case 'crowd_vibe':
        winner = bandResults.reduce((prev, current) =>
          current.crowdVibe > prev.crowdVibe ? current : prev
        )
        score = winner?.crowdVibe || 0
        break
      case 'crowd_vote':
        winner = bandResults.reduce((prev, current) =>
          current.crowdVote > prev.crowdVote ? current : prev
        )
        score = winner?.crowdVote || 0
        break
      case 'scream_o_meter':
        winner = bandResults.reduce((prev, current) =>
          (current.screamOMeter || 0) > (prev.screamOMeter || 0)
            ? current
            : prev
        )
        score = winner?.screamOMeter || 0
        break
      case 'visuals':
        winner = bandResults.reduce((prev, current) =>
          (current.visuals || 0) > (prev.visuals || 0) ? current : prev
        )
        score = winner?.visuals || 0
        break
    }

    return {
      categoryId: category.id,
      winnerName: winner?.name || 'N/A',
      score,
      maxScore: category.maxPoints,
    }
  })

  const overallWinner = bandResults[0]
  const totalVoters =
    bandResults.length > 0 ? bandResults[0].totalCrowdVotes || 0 : 0

  // Prepare data for ScoreBreakdown component
  const breakdownData: BandResultData[] = bandResults.map((band) => ({
    id: band.id,
    name: band.name,
    companySlug: band.companySlug,
    companyName: band.companyName,
    companyIconUrl: band.companyIconUrl,
    rank: band.rank,
    logoUrl: band.logoUrl,
    heroThumbnailUrl: band.heroThumbnailUrl,
    songChoice: band.songChoice,
    performance: band.performance,
    crowdVibe: band.crowdVibe,
    crowdVote: band.crowdVote,
    crowdVoteCount: band.crowdVoteCount,
    screamOMeter: band.screamOMeter,
    visuals: band.visuals,
    totalScore: band.totalScore,
  }))

  return (
    <>
      <EventJsonLd
        event={event}
        bands={bands}
        heroImageUrl={
          heroPhoto?.blob_url || (event.info?.image_url as string | undefined)
        }
      />
      <WebLayout breadcrumbs={breadcrumbs} navEvents={navEvents}>
        {/* Page Header */}
        <section className="py-12 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
            <h1 className="text-sm tracking-widest uppercase text-text-muted mb-3">
              Battle Results
            </h1>
            <h2 className="text-3xl lg:text-4xl font-semibold text-white mb-2">
              {event.name}
            </h2>
            <p className="text-text-muted">
              {formatEventDate(event.date, event.timezone)} • {event.location}
            </p>
          </div>
        </section>

        {/* Overall Winner */}
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <WinnerDisplay
              winnerName={overallWinner.name}
              companySlug={overallWinner.companySlug}
              companyName={overallWinner.companyName}
              companyIconUrl={overallWinner.companyIconUrl}
              totalScore={overallWinner.totalScore}
              logoUrl={overallWinner.logoUrl}
              heroThumbnailUrl={overallWinner.heroThumbnailUrl}
              heroFocalPoint={overallWinner.heroFocalPoint}
              scoringVersion={scoringVersion}
            />
            {/* Share buttons */}
            <div className="mt-8">
              <ShareResults
                eventName={event.name}
                winnerName={overallWinner.name}
                eventUrl={`${baseUrl}/results/${eventId}`}
              />
            </div>
          </div>
        </section>

        {/* Category Winners */}
        <CategoryWinners
          scoringVersion={scoringVersion}
          categoryWinners={categoryWinners}
        />

        {/* Full Results Table */}
        <ScoreBreakdown
          scoringVersion={scoringVersion}
          results={breakdownData}
          totalVoters={totalVoters}
        />

        {/* Band Links */}
        <section className="py-12 bg-bg-muted">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <h3 className="text-sm tracking-widest uppercase text-text-muted mb-6 text-center">
              Band Details
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bands.map((band) => (
                <Link key={band.id} href={`/band/${band.id}`}>
                  <Card variant="interactive" className="h-full">
                    <div className="flex items-center gap-3">
                      <BandThumbnail
                        logoUrl={band.info?.logo_url}
                        heroThumbnailUrl={band.hero_thumbnail_url}
                        bandName={band.name}
                        size="sm"
                      />
                      <div>
                        <h4 className="font-semibold text-white">
                          {band.name}
                        </h4>
                        <p className="text-sm text-text-muted">
                          View breakdown
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Photos Section */}
        <PhotoStrip eventId={eventId} />

        {/* Back to Event */}
        <section className="py-8 border-t border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 flex justify-center gap-4">
            <Link href={`/event/${eventId}`}>
              <Button variant="outline-solid">Back to Event</Button>
            </Link>
          </div>
        </section>
      </WebLayout>
    </>
  )
}
