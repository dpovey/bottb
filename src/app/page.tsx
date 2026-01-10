import type { Metadata } from 'next'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  getActiveEvent,
  getUpcomingEvents,
  getPastEvents,
  getBandScores,
  getBandsForEvent,
  getPhotosByLabel,
  hasFinalizedResults,
  getFinalizedResults,
  getPhotos,
  getPhotoCount,
  getVideos,
  PHOTO_LABELS,
} from '@/lib/db'
import { getNavEvents } from '@/lib/nav-data'
import { PublicLayout } from '@/components/layouts'
import { EventCard } from '@/components/event-card'
import { HeroCarousel } from '@/components/hero-carousel'
import { Button, ErrorBoundary, CompactErrorFallback } from '@/components/ui'
import {
  parseScoringVersion,
  hasDetailedBreakdown,
  calculateTotalScore,
  type BandScoreData,
} from '@/lib/scoring'
import { CompanyLogoMarquee } from '@/components/company-logo-marquee'
import {
  EventCardSkeleton,
  PhotoStripSkeleton,
  VideoStripSkeleton,
  CompanyLogoMarqueeSkeleton,
} from '@/components/skeletons/home-skeletons'
import { getBaseUrl } from '@/lib/seo'
import { DEFAULT_HERO_IMAGE } from '@/lib/stock-images'

// Dynamically import below-the-fold components to reduce initial bundle size
const PhotoStrip = dynamic(
  () =>
    import('@/components/photos/photo-strip').then((mod) => ({
      default: mod.PhotoStrip,
    })),
  {
    loading: () => (
      <section className="py-16 bg-bg-elevated">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-semibold text-3xl">From the Archives</h2>
          </div>
          <PhotoStripSkeleton />
        </div>
      </section>
    ),
    ssr: true, // Keep SSR for SEO
  }
)

const VideoStrip = dynamic(
  () =>
    import('@/components/videos/video-strip').then((mod) => ({
      default: mod.VideoStrip,
    })),
  {
    loading: () => (
      <section className="py-16 bg-bg">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <VideoStripSkeleton />
        </div>
      </section>
    ),
    ssr: true, // Keep SSR for SEO
  }
)

const ShortsCarousel = dynamic(
  () =>
    import('@/components/shorts-carousel').then((mod) => ({
      default: mod.ShortsCarousel,
    })),
  {
    loading: () => (
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="w-[140px] sm:w-[160px] shrink-0 aspect-[9/16] bg-bg-elevated rounded-xl animate-pulse"
          />
        ))}
      </div>
    ),
    ssr: true,
  }
)

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

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl()
  const activeEvent = await getActiveEvent()
  const globalHeroPhotos = await getPhotosByLabel(PHOTO_LABELS.GLOBAL_HERO)
  const heroPhoto = globalHeroPhotos.length > 0 ? globalHeroPhotos[0] : null
  const heroImageUrl = heroPhoto?.blob_url ?? DEFAULT_HERO_IMAGE.url

  let title = 'Battle of the Tech Bands'
  let description =
    "Where technology meets rock 'n' roll. A community charity event supporting Youngcare."

  if (activeEvent) {
    title = `${activeEvent.name} | Battle of the Tech Bands`
    description = `Vote now for ${activeEvent.name}! ${description}`
  }

  return {
    title,
    description,
    alternates: {
      canonical: baseUrl,
    },
    openGraph: {
      title,
      description,
      siteName: 'Battle of the Tech Bands',
      type: 'website',
      images: [
        {
          url: heroImageUrl,
          width: 1200,
          height: 630,
          alt: 'Battle of the Tech Bands',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [heroImageUrl],
    },
  }
}

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

export default async function HomePage() {
  // Parallelize all initial queries including photos and videos for strips
  const [
    activeEvent,
    upcomingEvents,
    pastEvents,
    globalHeroPhotos,
    initialPhotosData,
    initialVideosData,
    initialShortsData,
    initialPhotoCount,
    navEvents,
  ] = await Promise.all([
    getActiveEvent(),
    getUpcomingEvents(),
    getPastEvents(),
    getPhotosByLabel(PHOTO_LABELS.GLOBAL_HERO),
    // Fetch initial photos for PhotoStrip (random order, 50 photos)
    getPhotos({ limit: 50, orderBy: 'random' }),
    // Fetch initial videos for VideoStrip (20 full-length videos only, not shorts)
    getVideos({ limit: 20, videoType: 'video' }),
    // Fetch shorts for Highlights section
    getVideos({ limit: 12, videoType: 'short' }),
    // Get photo count for pagination
    getPhotoCount({}),
    // Nav events for header dropdown (cached)
    getNavEvents(),
  ])

  // Transform hero photos for carousel (supports multiple global heroes)
  const heroImages = globalHeroPhotos.map((photo) => ({
    url: photo.blob_url,
    urlHigh: photo.large_4k_url ?? undefined,
    focalPoint: photo.hero_focal_point,
    // Include photo URL fields for responsive srcset
    blob_url: photo.blob_url,
    large_4k_url: photo.large_4k_url ?? undefined,
  }))

  // Compute random initial index server-side to avoid flash on hydration
  // Intentionally random per-request for SSR - different hero on each page load
  const heroInitialIndex =
    heroImages.length > 0
      ? Math.floor(Math.random() * heroImages.length) // eslint-disable-line react-hooks/purity
      : 0

  const initialPhotos = initialPhotosData
  const initialVideos = initialVideosData
  const initialShorts = initialShortsData

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
          // Find the winning band to get company info
          const winnerBand = bands.find(
            (b) => b.name.toLowerCase() === storedWinner.toLowerCase()
          )
          return {
            ...event,
            overallWinner: {
              name: storedWinner,
              totalScore: 0,
              companySlug: winnerBand?.company_slug,
              companyName: winnerBand?.company_name,
              companyIconUrl: winnerBand?.company_icon_url,
            },
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
        if (finalizedResults.length > 0) {
          const winnerBand = bands.find(
            (b) => b.id === finalizedResults[0].band_id
          )
          const overallWinner = {
            name: finalizedResults[0].band_name,
            totalScore: Number(finalizedResults[0].total_score || 0),
            companySlug: winnerBand?.company_slug,
            companyName: winnerBand?.company_name,
            companyIconUrl: winnerBand?.company_icon_url,
          }
          return { ...event, overallWinner, bands, scoringVersion, heroPhoto }
        }
        return {
          ...event,
          overallWinner: null,
          bands,
          scoringVersion,
          heroPhoto,
        }
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

  return (
    <PublicLayout
      headerVariant="transparent"
      footerVariant="full"
      navEvents={navEvents}
    >
      {/* Hero Section - supports multiple global hero images */}
      <HeroCarousel
        images={heroImages}
        interval={8000}
        initialIndex={heroInitialIndex}
      >
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-8 pb-16 text-center">
          <h1 className="hero-text font-bold text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-4 leading-tight">
            Battle of the Tech Bands
          </h1>
          <p className="hero-text-muted text-lg sm:text-xl max-w-xl mx-auto mb-8">
            Where technology meets rock &apos;n&apos; roll. A community charity
            event supporting Youngcare.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {activeEvent && (
              <>
                <Link href={`/vote/crowd/${activeEvent.id}`}>
                  <Button variant="accent" size="lg">
                    Vote Now
                  </Button>
                </Link>
                <Link href={`/event/${activeEvent.id}`}>
                  <Button variant="outline-solid" size="lg">
                    Event
                  </Button>
                </Link>
              </>
            )}
            <Link href="/photos">
              <Button variant="outline-solid" size="lg">
                Photos
              </Button>
            </Link>
            <Link href="/videos">
              <Button variant="outline-solid" size="lg">
                Videos
              </Button>
            </Link>
          </div>
        </div>
      </HeroCarousel>

      {/* Active Event Section */}
      {activeEvent && (
        <section className="py-16 bg-bg">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-sm tracking-widest uppercase text-accent mb-3">
                Happening Now
              </h2>
              <p className="text-text-muted text-lg">
                Cast your vote and support your favorite band
              </p>
            </div>

            <EventCard
              event={activeEvent}
              relativeDate="Live Now"
              bands={[]} // Could fetch bands here if needed
              variant="active"
            />
          </div>
        </section>
      )}

      {/* Upcoming Events Section */}
      {upcomingEventsWithBands.length > 0 && (
        <section className="py-16 bg-bg-muted">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex items-center justify-between mb-10">
              <h2 className="font-semibold text-3xl sm:text-4xl">
                Upcoming Events
              </h2>
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

      {/* Past Events Section - Wrapped in Suspense + ErrorBoundary */}
      <ErrorBoundary
        sectionName="Past Events"
        fallback={
          <section className="py-16 bg-bg-elevated">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <CompactErrorFallback message="Failed to load past events" />
            </div>
          </section>
        }
      >
        <Suspense
          fallback={
            <section className="py-16 bg-bg-elevated">
              <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <div className="flex items-center justify-between mb-10">
                  <h2 className="font-semibold text-3xl sm:text-4xl">
                    Past Events
                  </h2>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <EventCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            </section>
          }
        >
          {pastEventsWithWinners.length > 0 && (
            <section className="py-16 bg-bg-elevated">
              <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <div className="flex items-center justify-between mb-10">
                  <h2 className="font-semibold text-3xl sm:text-4xl">
                    Past Events
                  </h2>
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
        </Suspense>
      </ErrorBoundary>

      {/* Random Photo Strip - Wrapped in Suspense + ErrorBoundary */}
      <ErrorBoundary
        sectionName="Photo Gallery"
        fallback={
          <section className="py-16 bg-bg-elevated">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <CompactErrorFallback message="Failed to load photos" />
            </div>
          </section>
        }
      >
        <Suspense
          fallback={
            <section className="py-16 bg-bg-elevated">
              <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="font-semibold text-3xl">From the Archives</h2>
                </div>
                <PhotoStripSkeleton />
              </div>
            </section>
          }
        >
          <PhotoStrip
            title="From the Archives"
            viewAllLink="/photos"
            initialPhotos={initialPhotos}
            initialTotalCount={initialPhotoCount}
          />
        </Suspense>
      </ErrorBoundary>

      {/* Video Strip - Wrapped in Suspense + ErrorBoundary */}
      <ErrorBoundary
        sectionName="Videos"
        fallback={
          <section className="py-16 bg-bg">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <CompactErrorFallback message="Failed to load videos" />
            </div>
          </section>
        }
      >
        <Suspense
          fallback={
            <section className="py-16 bg-bg">
              <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <VideoStripSkeleton />
              </div>
            </section>
          }
        >
          <VideoStrip
            title="Standout Performances"
            initialVideos={initialVideos}
            location="home_page"
          />
        </Suspense>
      </ErrorBoundary>

      {/* Highlights (Shorts) - Wrapped in Suspense + ErrorBoundary */}
      {initialShorts && initialShorts.length > 0 && (
        <ErrorBoundary
          sectionName="Highlights"
          fallback={
            <section className="py-16 bg-bg-muted">
              <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <CompactErrorFallback message="Failed to load quick clips" />
              </div>
            </section>
          }
        >
          <Suspense
            fallback={
              <section className="py-16 bg-bg-muted">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="h-8 w-32 bg-bg-elevated rounded animate-pulse" />
                  </div>
                  <div className="flex gap-4 overflow-hidden">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-[140px] sm:w-[160px] shrink-0 aspect-[9/16] bg-bg-elevated rounded-xl animate-pulse"
                      />
                    ))}
                  </div>
                </div>
              </section>
            }
          >
            <section className="py-16 bg-bg-muted">
              <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <ShortsCarousel
                  videos={initialShorts}
                  title="Highlights"
                  showBandInfo={true}
                  location="home_page"
                />
              </div>
            </section>
          </Suspense>
        </ErrorBoundary>
      )}

      {/* Company Logo Marquee - Wrapped in Suspense + ErrorBoundary */}
      <ErrorBoundary
        sectionName="Companies"
        fallback={
          <section className="py-16 bg-bg border-t border-white/5">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <CompactErrorFallback message="Failed to load companies" />
            </div>
          </section>
        }
      >
        <Suspense
          fallback={
            <section className="py-16 bg-bg border-t border-white/5">
              <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <div className="text-center mb-10">
                  <h2 className="text-sm tracking-widest uppercase text-accent mb-2">
                    Companies Who&apos;ve Competed
                  </h2>
                </div>
                <CompanyLogoMarqueeSkeleton />
              </div>
            </section>
          }
        >
          <CompanyLogoMarquee />
        </Suspense>
      </ErrorBoundary>

      {/* CTA Section */}
      <section className="py-20 bg-bg-muted border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-semibold text-white mb-4">
            Join the Movement
          </h2>
          <p className="text-text-muted mb-8">
            Battle of the Tech Bands brings together technology professionals
            for an unforgettable night of rock, competition, and charity.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/about">
              <Button variant="outline-solid" size="lg">
                About Battle of the Tech Bands
              </Button>
            </Link>
            <Link href="/photos">
              <Button variant="ghost" size="lg">
                Gallery
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
