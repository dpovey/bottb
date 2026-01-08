'use client'

import Link from 'next/link'
import { formatEventDate } from '@/lib/date-utils'
import { WebLayout } from '@/components/layouts'
import {
  Button,
  Badge,
  Card,
  DateBadge,
  BandThumbnail,
  CompanyBadge,
  NumberedIndicator,
  TicketCTA,
  HeroBackground,
  photosToHeroImages,
} from '@/components/ui'
import { ChevronRightIcon } from '@/components/icons'
import { PhotoStrip } from '@/components/photos/photo-strip'
import { VideoCarousel } from '@/components/video-carousel'
import { ShortsCarousel } from '@/components/shorts-carousel'
import type { Video, Band as DbBand, Event as DbEvent, Photo } from '@/lib/db'
import type { NavEvent } from '@/components/nav'
import { parseScoringVersion, hasDetailedBreakdown } from '@/lib/scoring'

interface EventPageClientProps {
  event: DbEvent
  bands: DbBand[]
  heroPhotos: Photo[]
  videos: Video[]
  shorts?: Video[]
  navEvents?: {
    upcoming: NavEvent[]
    past: NavEvent[]
  }
}

function getStatusBadge(status: string, hasWinner: boolean) {
  switch (status) {
    case 'voting':
      return <Badge variant="success">Voting Open</Badge>
    case 'finalized':
      return hasWinner ? (
        <Badge variant="warning">Completed</Badge>
      ) : (
        <Badge variant="accent">Results Available</Badge>
      )
    case 'upcoming':
      return <Badge variant="info">Upcoming</Badge>
    default:
      return <Badge variant="default">{status}</Badge>
  }
}

interface EventInfo {
  image_url?: string
  description?: string
  website?: string
  ticket_url?: string
  social_media?: {
    twitter?: string
    instagram?: string
    facebook?: string
  }
  venue_info?: string
  scoring_version?: string
  winner?: string
  [key: string]: unknown
}

export function EventPageClient({
  event,
  bands,
  heroPhotos,
  videos,
  shorts = [],
  navEvents,
}: EventPageClientProps) {
  const eventId = event.id
  const eventInfo = event.info as EventInfo | undefined
  const heroImages = photosToHeroImages(heroPhotos)

  const breadcrumbs = [
    { label: 'Events', href: '/events' },
    { label: event.name },
  ]

  // Get scoring version and winner info
  const scoringVersion = parseScoringVersion(eventInfo)
  const showDetailedBreakdown = hasDetailedBreakdown(scoringVersion)
  const storedWinner = eventInfo?.winner
  const isFinalized = event.status === 'finalized'

  // For 2022.1 events, we show the stored winner prominently
  const show2022Winner = isFinalized && !showDetailedBreakdown && storedWinner

  // Find winner band for company info display
  const winnerBand = show2022Winner
    ? bands.find((b) => b.name.toLowerCase() === storedWinner?.toLowerCase())
    : undefined

  return (
    <WebLayout breadcrumbs={breadcrumbs} navEvents={navEvents}>
      {/* Hero Section with Event Image(s) - supports multiple hero photos */}
      <section className="relative min-h-[40vh] flex items-end">
        {/* Background Image - supports multiple photos with crossfade */}
        <HeroBackground
          photos={heroImages}
          fallbackImageUrl={eventInfo?.image_url}
          alt={`${event.name} event`}
        />

        {/* Overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/60 to-transparent" />

        {/* Content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-8 pb-8">
          <div className="flex flex-col md:flex-row md:items-end gap-6">
            {/* Date Badge */}
            <DateBadge
              date={event.date}
              timezone={event.timezone}
              size="lg"
              showYear
            />

            {/* Event Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {getStatusBadge(event.status, !!show2022Winner)}
              </div>
              <h1 className="hero-text text-4xl lg:text-5xl font-semibold text-white mb-2">
                {event.name}
              </h1>
              <div className="hero-text-muted text-lg">
                {formatEventDate(event.date, event.timezone)} • {event.location}
              </div>
              {event.description && (
                <p className="hero-text-muted mt-3 max-w-2xl">
                  {event.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Winner Section - For 2022.1 finalized events with company badge */}
      {show2022Winner && (
        <section className="py-8 bg-linear-to-r from-warning/10 via-warning/5 to-warning/10 border-b border-warning/20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-4xl">🏆</span>
                <div>
                  <p className="text-sm text-warning uppercase tracking-widest">
                    Champion
                  </p>
                  <p className="text-2xl font-semibold text-white">
                    {storedWinner}
                  </p>
                  {winnerBand ? (
                    <div className="mt-1">
                      <CompanyBadge
                        slug={winnerBand.company_slug || 'unknown'}
                        name={winnerBand.company_name || 'Unknown Company'}
                        iconUrl={winnerBand.company_icon_url}
                        variant="default"
                        size="sm"
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-red-400">Band not found</p>
                  )}
                </div>
              </div>
              <Link href={`/results/${eventId}`}>
                <Button variant="outline-solid" size="sm">
                  Results
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Action Section */}
      {(event.status === 'voting' ||
        event.status === 'finalized' ||
        event.status === 'upcoming') && (
        <section className="py-8 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex flex-wrap gap-4 items-center">
              {event.status === 'upcoming' && eventInfo?.ticket_url && (
                <TicketCTA ticketUrl={eventInfo.ticket_url} variant="compact" />
              )}
              {event.status === 'voting' && (
                <Link href={`/vote/crowd/${eventId}`}>
                  <Button variant="accent" size="lg">
                    Vote for Bands
                  </Button>
                </Link>
              )}
              {event.status === 'finalized' && !show2022Winner && (
                <Link href={`/results/${eventId}`}>
                  <Button variant="accent" size="lg">
                    Results
                  </Button>
                </Link>
              )}
              {event.status !== 'upcoming' && (
                <Link href={`/photos?event=${eventId}`}>
                  <Button variant="outline-solid" size="lg">
                    Photos
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Description Section */}
      {eventInfo?.description && (
        <section className="py-12 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <p className="text-text-muted text-lg max-w-3xl">
              {eventInfo.description}
            </p>
          </div>
        </section>
      )}

      {/* Bands Section */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-sm tracking-widest uppercase text-text-muted mb-2">
              {isFinalized ? 'Competed' : 'Performing'}
            </h2>
            <p className="text-2xl font-semibold text-white">
              {bands.length} Band{bands.length !== 1 ? 's' : ''}
            </p>
          </div>

          {bands.length === 0 ? (
            <Card variant="elevated" className="text-center py-12">
              <p className="text-text-muted">
                No bands registered for this event yet.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {bands.map((band) => {
                const isWinner = show2022Winner && band.name === storedWinner

                return (
                  <Link key={band.id} href={`/band/${band.id}`}>
                    <Card
                      variant="interactive"
                      padding="none"
                      className={`overflow-hidden ${
                        isWinner ? 'border-warning/30 bg-warning/5' : ''
                      }`}
                    >
                      <div className="flex items-center p-4 md:p-6 gap-4 md:gap-6">
                        {/* Order Number or Trophy */}
                        {isWinner ? (
                          <div className="w-10 h-10 flex items-center justify-center rounded-lg shrink-0 bg-warning/20">
                            <span className="text-lg">🏆</span>
                          </div>
                        ) : (
                          <NumberedIndicator
                            number={band.order}
                            shape="square"
                            size="lg"
                            variant="muted"
                          />
                        )}

                        {/* Band Logo */}
                        <BandThumbnail
                          logoUrl={band.info?.logo_url}
                          heroThumbnailUrl={band.hero_thumbnail_url}
                          bandName={band.name}
                          size="md"
                        />

                        {/* Band Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3
                              className={`text-lg font-semibold truncate ${
                                isWinner ? 'text-warning' : 'text-white'
                              }`}
                            >
                              {band.name}
                            </h3>
                            {isWinner && (
                              <Badge variant="warning" className="shrink-0">
                                Champion
                              </Badge>
                            )}
                          </div>
                          {/* Company badge - asLink=false to avoid nested <a> tags */}
                          {band.company_slug && band.company_name && (
                            <div className="mt-1">
                              <CompanyBadge
                                slug={band.company_slug}
                                name={band.company_name}
                                iconUrl={band.company_icon_url}
                                variant="default"
                                size="sm"
                                asLink={false}
                              />
                            </div>
                          )}
                          {band.info?.genre && (
                            <p className="text-text-dim text-xs mt-1">
                              {band.info.genre}
                            </p>
                          )}
                        </div>

                        {/* Arrow */}
                        <div className="shrink-0 text-text-dim">
                          <ChevronRightIcon className="w-5 h-5" />
                        </div>
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Ticket CTA Section - for upcoming events */}
      {event.status === 'upcoming' && eventInfo?.ticket_url && (
        <section className="py-12 border-t border-white/5">
          <div className="max-w-2xl mx-auto px-6 lg:px-8">
            <TicketCTA
              ticketUrl={eventInfo.ticket_url}
              eventName={event.name}
            />
          </div>
        </section>
      )}

      {/* Photos Section */}
      <PhotoStrip eventId={eventId} />

      {/* Videos Section */}
      {videos.length > 0 && (
        <section className="py-12 border-t border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <VideoCarousel
              videos={videos}
              title="Videos"
              showBandInfo={true}
              location="event_page"
            />
          </div>
        </section>
      )}

      {/* Shorts Section */}
      {shorts.length > 0 && (
        <section className="py-12 border-t border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <ShortsCarousel
              videos={shorts}
              title="Shorts"
              showBandInfo={true}
              location="event_page"
            />
          </div>
        </section>
      )}
    </WebLayout>
  )
}
