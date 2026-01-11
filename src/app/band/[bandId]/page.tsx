import type { Metadata } from 'next'
import {
  getBandScores,
  getBandsForEvent,
  getPhotosByLabel,
  getVideos,
  getSetlistForBand,
  hasFinalizedResults,
  getFinalizedResults,
  PHOTO_LABELS,
  SetlistSong,
  type Band,
} from '@/lib/db'
import { slugify } from '@/lib/utils'
import { notFound } from 'next/navigation'
import { formatEventDate } from '@/lib/date-utils'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import {
  CompanyBadge,
  BandThumbnail,
  SocialIconLink,
  HeroBackground,
  photosToHeroImages,
} from '@/components/ui'
import { PhotoStrip } from '@/components/photos/photo-strip'
import { VideoCarousel } from '@/components/video-carousel'
import { ShortsCarousel } from '@/components/shorts-carousel'
import {
  parseScoringVersion,
  hasDetailedBreakdown,
  calculateTotalScore,
  type BandScoreData,
} from '@/lib/scoring'
import { getBaseUrl, buildSeoTitle, buildSeoDescription } from '@/lib/seo'
import { MusicGroupJsonLd } from '@/components/seo'
import {
  TwitterIcon,
  InstagramIcon,
  FacebookIcon,
  YouTubeIcon,
  ExternalLinkIcon,
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@/components/icons'

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
  crowd_noise_energy?: number
  crowd_noise_peak?: number
  crowd_score?: number
}

interface EventInfo {
  scoring_version?: string
  winner?: string
  [key: string]: unknown
}

// Progress bar component
function ProgressBar({
  value,
  max,
  className = '',
}: {
  value: number
  max: number
  className?: string
}) {
  const percent = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="h-2 bg-bg-surface rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-1000 ${
          className || 'bg-accent'
        }`}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

// Score category row component
function ScoreRow({
  emoji,
  label,
  value,
  max,
  progressClassName,
}: {
  emoji: string
  label: string
  value: number
  max: number
  progressClassName?: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-text-muted">
          {emoji} {label}
        </span>
        <span className="font-medium">
          {value.toFixed(1)}
          <span className="text-text-dim">/{max}</span>
        </span>
      </div>
      <ProgressBar value={value} max={max} className={progressClassName} />
    </div>
  )
}

// Circular progress component for crowd vote
function CircularProgress({ percent }: { percent: number }) {
  // SVG circle math: circumference = 2 * pi * r
  // For r=16, circumference ≈ 100.53
  const dashoffset = 100.53 - (percent / 100) * 100.53

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg
        className="w-full h-full -rotate-90"
        viewBox="0 0 36 36"
        style={{ transformOrigin: 'center' }}
      >
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          className="stroke-bg-surface"
          strokeWidth="3"
        />
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          className="stroke-accent"
          strokeWidth="3"
          strokeDasharray="100.53"
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-semibold">{Math.round(percent)}%</span>
      </div>
    </div>
  )
}

/**
 * A display row represents either:
 * - A regular song (cover, mashup, medley)
 * - The "transition" part of a transition song (original song)
 * - The "cover" part of a transition song (transition_to song)
 */
interface SetlistDisplayRow {
  id: string // Unique key for React
  song: SetlistSong // Original song record
  title: string // Display title
  artist: string // Display artist
  displayType: 'cover' | 'mashup' | 'medley' | 'transition' // Display label
  position: number // Position number to display
  showPosition: boolean // Whether to show position (false for second row of transition)
}

/**
 * Transform songs into display rows, splitting transitions into two separate rows.
 */
function transformToSetlistDisplayRows(
  songs: SetlistSong[]
): SetlistDisplayRow[] {
  const rows: SetlistDisplayRow[] = []

  for (const song of songs) {
    if (
      song.song_type === 'transition' &&
      song.transition_to_title &&
      song.transition_to_artist
    ) {
      // Split transition into two rows
      // Row 1: Original song (transition)
      rows.push({
        id: `${song.id}-transition`,
        song,
        title: song.title,
        artist: song.artist,
        displayType: 'transition',
        position: song.position,
        showPosition: true,
      })
      // Row 2: Transition-to song (cover)
      rows.push({
        id: `${song.id}-cover`,
        song,
        title: song.transition_to_title,
        artist: song.transition_to_artist,
        displayType: 'cover',
        position: song.position,
        showPosition: false, // Don't show position for second row
      })
    } else {
      // Regular song (cover, mashup, medley)
      rows.push({
        id: song.id,
        song,
        title: song.title,
        artist: song.artist,
        displayType: song.song_type,
        position: song.position,
        showPosition: true,
      })
    }
  }

  return rows
}

// Setlist Section Component
function SetlistSection({ songs }: { songs: SetlistSong[] }) {
  if (songs.length === 0) return null

  const getSongTypeLabel = (type: string) => {
    const labels: Record<string, { text: string; className: string }> = {
      cover: { text: 'Cover', className: 'bg-white/10 text-text-muted' },
      mashup: { text: 'Mashup', className: 'bg-accent/20 text-accent' },
      medley: { text: 'Medley', className: 'bg-info/20 text-info' },
      transition: {
        text: 'Transition',
        className: 'bg-success/20 text-success',
      },
    }
    return labels[type] || labels.cover
  }

  // Transform songs to display rows (splits transitions into 2 rows)
  const displayRows = transformToSetlistDisplayRows(songs)

  return (
    <section className="py-12 border-t border-white/5">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <h2 className="text-sm tracking-widest uppercase text-text-muted mb-6">
          Setlist
        </h2>
        <div className="bg-bg-elevated rounded-xl border border-white/5 overflow-hidden">
          {displayRows.map((row, index) => {
            const typeLabel = getSongTypeLabel(row.displayType)
            const isLast = index === displayRows.length - 1
            const { song } = row

            return (
              <div
                key={row.id}
                className={`flex items-center gap-4 p-4 ${
                  !isLast ? 'border-b border-white/5' : ''
                }`}
              >
                {/* Position number */}
                <div className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center text-text-muted font-semibold text-sm shrink-0">
                  {row.showPosition ? row.position : ''}
                </div>

                {/* Song info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/songs/${slugify(row.artist)}/${slugify(row.title)}`}
                      className="font-medium text-white hover:text-accent transition-colors"
                    >
                      {row.title}
                    </Link>
                    {row.displayType !== 'cover' && (
                      <span
                        className={`px-2 py-0.5 rounded-sm text-[10px] font-medium uppercase tracking-wider ${typeLabel.className}`}
                      >
                        {typeLabel.text}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-text-muted mt-0.5">
                    <Link
                      href={`/songs/${slugify(row.artist)}`}
                      className="hover:text-accent transition-colors"
                    >
                      {row.artist}
                    </Link>
                    {/* Show additional songs for mashups/medleys */}
                    {(row.displayType === 'mashup' ||
                      row.displayType === 'medley') &&
                      song.additional_songs &&
                      song.additional_songs.length > 0 && (
                        <>
                          {song.additional_songs.map((additional, idx) => (
                            <span key={idx}>
                              {' / '}
                              <Link
                                href={`/songs/${slugify(additional.artist)}`}
                                className="hover:text-accent transition-colors"
                              >
                                {additional.artist}
                              </Link>
                              {' - '}
                              <Link
                                href={`/songs/${slugify(additional.artist)}/${slugify(additional.title)}`}
                                className="hover:text-accent transition-colors"
                              >
                                {additional.title}
                              </Link>
                            </span>
                          ))}
                        </>
                      )}
                  </div>
                </div>

                {/* Media links - only show on primary row for transitions */}
                <div className="flex items-center gap-1 shrink-0">
                  {row.showPosition && song.spotify_track_id && (
                    <a
                      href={`https://open.spotify.com/track/${song.spotify_track_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-text-dim hover:text-[#1DB954] transition-colors p-2"
                      title="Listen on Spotify"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                      </svg>
                    </a>
                  )}
                  {row.showPosition && song.youtube_video_id && (
                    <a
                      href={`https://www.youtube.com/watch?v=${song.youtube_video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-text-dim hover:text-accent transition-colors p-2"
                      title="Watch on YouTube"
                    >
                      <YouTubeIcon size={20} />
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ bandId: string }>
}): Promise<Metadata> {
  const { bandId } = await params
  const baseUrl = getBaseUrl()

  // Get band data
  const { sql } = await import('@vercel/postgres')
  const { rows: bandData } = await sql`
    SELECT b.*, 
           e.name as event_name, e.date, e.location, e.timezone, e.status, e.info as event_info,
           c.name as company_name, c.slug as company_slug, c.icon_url as company_icon_url,
           (SELECT blob_url FROM photos WHERE band_id = b.id AND 'band_hero' = ANY(labels) LIMIT 1) as hero_thumbnail_url
    FROM bands b
    JOIN events e ON b.event_id = e.id
    LEFT JOIN companies c ON b.company_slug = c.slug
    WHERE b.id = ${bandId}
  `

  if (bandData.length === 0) {
    return {
      title: 'Band Not Found | Battle of the Tech Bands',
    }
  }

  const band = bandData[0]

  // Build title - use tiered suffix approach (full → short → none)
  // Preserves the unique content (band name, event) which is more valuable for SEO
  const title = buildSeoTitle(`${band.name} at ${band.event_name}`)

  // Build description - include company and band description if available
  let description = `${band.name}`
  if (band.company_name) {
    description += ` from ${band.company_name}`
  }
  description += ` performing at ${band.event_name}`
  // Append band description if it's a real description (>50 chars)
  if (band.description && band.description.length > 50) {
    description += `. ${band.description}`
  }
  // Ensure description fits within SEO limits (truncates at word boundary)
  description = buildSeoDescription(description)

  // Get hero image
  const bandHeroPhotos = await getPhotosByLabel(PHOTO_LABELS.BAND_HERO, {
    bandId,
  })
  const heroPhoto = bandHeroPhotos.length > 0 ? bandHeroPhotos[0] : null
  const ogImage = heroPhoto?.blob_url || band.info?.logo_url || undefined

  return {
    title,
    description,
    alternates: {
      canonical: `${baseUrl}/band/${bandId}`,
    },
    openGraph: {
      title,
      description,
      type: 'profile',
      images: ogImage
        ? [
            {
              url: ogImage,
              width: 1200,
              height: 630,
              alt: `${band.name} at ${band.event_name}`,
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

export default async function BandPage({
  params,
}: {
  params: Promise<{ bandId: string }>
}) {
  const { bandId } = await params

  // Check if user is admin
  const session = await auth()
  const isAdmin = session?.user?.isAdmin || false

  // Get all events to find which one contains this band
  const { sql } = await import('@vercel/postgres')
  const { rows: bandData } = await sql`
    SELECT b.*, 
           e.name as event_name, e.date, e.location, e.timezone, e.status, e.info as event_info,
           c.name as company_name, c.slug as company_slug, c.icon_url as company_icon_url,
           (SELECT blob_url FROM photos WHERE band_id = b.id AND 'band_hero' = ANY(labels) LIMIT 1) as hero_thumbnail_url
    FROM bands b
    JOIN events e ON b.event_id = e.id
    LEFT JOIN companies c ON b.company_slug = c.slug
    WHERE b.id = ${bandId}
  `

  if (bandData.length === 0) {
    notFound()
  }

  const band = bandData[0]
  if (!band || !band.event_id) {
    notFound()
  }

  const eventId = band.event_id
  const eventStatus = band.status
  const eventInfo = band.event_info as EventInfo | null
  const scoringVersion = parseScoringVersion(eventInfo)
  const showDetailedBreakdown = hasDetailedBreakdown(scoringVersion)

  // Fetch band hero photos (supports multiple heroes)
  const bandHeroPhotos = await getPhotosByLabel(PHOTO_LABELS.BAND_HERO, {
    bandId,
  })
  const heroImages = photosToHeroImages(bandHeroPhotos)

  // Fetch all bands for the event to enable navigation
  const allBands = await getBandsForEvent(eventId)
  const currentBandIndex = allBands.findIndex((b) => b.id === bandId)
  const prevBand = currentBandIndex > 0 ? allBands[currentBandIndex - 1] : null
  const nextBand =
    currentBandIndex < allBands.length - 1
      ? allBands[currentBandIndex + 1]
      : null

  // Fetch videos and shorts for this band
  const [videos, shorts] = await Promise.all([
    getVideos({ bandId, videoType: 'video' }),
    getVideos({ bandId, videoType: 'short' }),
  ])

  // Fetch setlist for this band (only shown when event is finalized)
  let setlist: SetlistSong[] = []
  if (eventStatus === 'finalized' || isAdmin) {
    setlist = await getSetlistForBand(bandId)
  }

  // Only fetch scores if event is finalized or user is admin
  let scores: BandScore[] = []
  let bandScore: BandScore | null = null

  if (eventStatus === 'finalized' || isAdmin) {
    // Check if event is finalized and has finalized results
    if (eventStatus === 'finalized' && (await hasFinalizedResults(eventId))) {
      // Use finalized results from table
      const finalizedResults = await getFinalizedResults(eventId)
      const finalizedResult = finalizedResults.find((r) => r.band_id === bandId)

      if (finalizedResult) {
        // Transform finalized result to match BandScore format for compatibility
        const allBands = await getBandsForEvent(eventId)
        const band = allBands.find((b) => b.id === bandId)
        bandScore = {
          id: finalizedResult.band_id,
          name: finalizedResult.band_name,
          order: finalizedResult.final_rank,
          avg_song_choice: Number(finalizedResult.avg_song_choice || 0),
          avg_performance: Number(finalizedResult.avg_performance || 0),
          avg_crowd_vibe: Number(finalizedResult.avg_crowd_vibe || 0),
          avg_visuals: finalizedResult.avg_visuals
            ? Number(finalizedResult.avg_visuals)
            : undefined,
          avg_crowd_vote: 0, // Not stored in finalized results
          crowd_vote_count: finalizedResult.crowd_vote_count,
          judge_vote_count: finalizedResult.judge_vote_count,
          total_crowd_votes: finalizedResult.total_crowd_votes,
          crowd_score: finalizedResult.crowd_noise_score || undefined,
          crowd_noise_energy: finalizedResult.crowd_noise_energy || undefined,
          crowd_noise_peak: finalizedResult.crowd_noise_peak || undefined,
          hero_thumbnail_url: band?.hero_thumbnail_url,
          hero_focal_point: band?.hero_focal_point,
          info: band?.info,
          company_slug: band?.company_slug,
          company_name: band?.company_name,
          company_icon_url: band?.company_icon_url,
        } as BandScore

        // Create scores array for compatibility with existing code
        scores = finalizedResults.map((r) => {
          const b = allBands.find((b) => b.id === r.band_id)
          return {
            id: r.band_id,
            name: r.band_name,
            order: r.final_rank,
            avg_song_choice: Number(r.avg_song_choice || 0),
            avg_performance: Number(r.avg_performance || 0),
            avg_crowd_vibe: Number(r.avg_crowd_vibe || 0),
            avg_visuals: r.avg_visuals ? Number(r.avg_visuals) : undefined,
            avg_crowd_vote: 0,
            crowd_vote_count: r.crowd_vote_count,
            judge_vote_count: r.judge_vote_count,
            total_crowd_votes: r.total_crowd_votes,
            crowd_score: r.crowd_noise_score || undefined,
            crowd_noise_energy: r.crowd_noise_energy || undefined,
            crowd_noise_peak: r.crowd_noise_peak || undefined,
            hero_thumbnail_url: b?.hero_thumbnail_url,
            hero_focal_point: b?.hero_focal_point,
            info: b?.info,
            company_slug: b?.company_slug,
            company_name: b?.company_name,
            company_icon_url: b?.company_icon_url,
          } as BandScore
        })
      }
    } else {
      // Calculate scores dynamically for non-finalized events or admin preview
      scores = (await getBandScores(eventId)) as BandScore[]
      bandScore = scores.find((score) => score.id === bandId) || null
    }
  }

  // For 2022.1 events, check if this band is the winner
  const isWinner = !showDetailedBreakdown && eventInfo?.winner === band.name

  // Calculate scores only if we have band score data and detailed breakdown
  let totalScore = 0
  let judgeScore = 0
  let crowdVoteScore = 0
  let screamOMeterScore = 0
  let visualsScore = 0

  if (showDetailedBreakdown && bandScore) {
    const scoreData: BandScoreData = {
      avg_song_choice: bandScore.avg_song_choice,
      avg_performance: bandScore.avg_performance,
      avg_crowd_vibe: bandScore.avg_crowd_vibe,
      avg_visuals: bandScore.avg_visuals,
      crowd_vote_count: bandScore.crowd_vote_count,
      total_crowd_votes: bandScore.total_crowd_votes,
      crowd_score: bandScore.crowd_score,
    }

    // Calculate normalized crowd vote score
    const maxVoteCount = Math.max(
      ...scores.map((s) => Number(s.crowd_vote_count || 0))
    )
    crowdVoteScore =
      maxVoteCount > 0
        ? (Number(bandScore.crowd_vote_count || 0) / maxVoteCount) * 10
        : 0

    // Version-specific scores
    if (scoringVersion === '2025.1') {
      screamOMeterScore = bandScore.crowd_score
        ? Number(bandScore.crowd_score)
        : 0
    } else if (scoringVersion === '2026.1') {
      visualsScore = Number(bandScore.avg_visuals || 0)
    }

    // Calculate total
    totalScore = calculateTotalScore(
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

    judgeScore =
      Number(bandScore.avg_song_choice || 0) +
      Number(bandScore.avg_performance || 0) +
      Number(bandScore.avg_crowd_vibe || 0)

    if (scoringVersion === '2026.1') {
      judgeScore += visualsScore
    }
  }

  // Calculate crowd vote percentage
  const crowdVotePercent = bandScore?.total_crowd_votes
    ? (Number(bandScore.crowd_vote_count || 0) /
        Number(bandScore.total_crowd_votes)) *
      100
    : 0

  // Check if this band has the highest crowd votes
  const isHighestVoted =
    bandScore &&
    scores.length > 0 &&
    Number(bandScore.crowd_vote_count || 0) ===
      Math.max(...scores.map((s) => Number(s.crowd_vote_count || 0)))

  const crowdVibeMax = scoringVersion === '2026.1' ? 20 : 30
  const maxJudgePoints = scoringVersion === '2026.1' ? 90 : 80

  const canShowScores = eventStatus === 'finalized' || isAdmin

  // Find band rank
  const bandRank =
    bandScore && scores.length > 0
      ? scores
          .map((s) => ({
            id: s.id,
            total: calculateTotalScore(
              {
                avg_song_choice: s.avg_song_choice,
                avg_performance: s.avg_performance,
                avg_crowd_vibe: s.avg_crowd_vibe,
                avg_visuals: s.avg_visuals,
                crowd_vote_count: s.crowd_vote_count,
                total_crowd_votes: s.total_crowd_votes,
                crowd_score: s.crowd_score,
              },
              scoringVersion,
              scores.map((sc) => ({
                avg_song_choice: sc.avg_song_choice,
                avg_performance: sc.avg_performance,
                avg_crowd_vibe: sc.avg_crowd_vibe,
                avg_visuals: sc.avg_visuals,
                crowd_vote_count: sc.crowd_vote_count,
                total_crowd_votes: sc.total_crowd_votes,
                crowd_score: sc.crowd_score,
              }))
            ),
          }))
          .sort((a, b) => b.total - a.total)
          .findIndex((s) => s.id === bandId) + 1
      : null

  const isEventWinner = bandRank === 1 && showDetailedBreakdown

  return (
    <div className="bg-bg min-h-screen">
      <MusicGroupJsonLd
        band={band as Band}
        eventName={band.event_name}
        eventDate={band.date}
        eventLocation={band.location}
      />
      {/* Hero Section - supports multiple band hero photos */}
      <section className="relative min-h-[70vh] flex items-end">
        {/* Background Image(s) - crossfades if multiple */}
        <HeroBackground photos={heroImages} alt={`${band.name}`} />

        {/* Overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/60 to-transparent" />

        {/* Content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-8 pb-16 pt-32">
          <div className="flex flex-col md:flex-row items-start gap-8">
            {/* Band Logo */}
            <BandThumbnail
              logoUrl={band.info?.logo_url}
              heroThumbnailUrl={band.hero_thumbnail_url}
              bandName={band.name}
              size="hero"
            />

            {/* Band Info */}
            <div className="flex-1">
              {/* Badges */}
              {canShowScores && (isWinner || isEventWinner) && (
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="bg-warning/20 border border-warning/30 text-warning px-3 py-1 rounded-sm text-xs tracking-widest uppercase">
                    🏆 Event Winner
                  </span>
                  {showDetailedBreakdown && bandRank && (
                    <span className="bg-white/10 border border-white/20 text-white px-3 py-1 rounded-sm text-xs tracking-widest uppercase">
                      {bandRank === 1
                        ? '1st Place'
                        : bandRank === 2
                          ? '2nd Place'
                          : bandRank === 3
                            ? '3rd Place'
                            : `${bandRank}th Place`}
                    </span>
                  )}
                </div>
              )}

              {/* Band Name */}
              <h1 className="font-semibold text-4xl sm:text-5xl md:text-6xl mb-3">
                {band.name}
              </h1>

              {/* Company Badge */}
              {band.company_slug && band.company_name && (
                <div className="mb-3">
                  <CompanyBadge
                    slug={band.company_slug}
                    name={band.company_name}
                    iconUrl={band.company_icon_url}
                    variant="default"
                    size="md"
                  />
                </div>
              )}

              {/* Event Link */}
              <Link
                href={`/event/${eventId}`}
                className="inline-flex items-center gap-2 text-text-muted hover:text-white transition-colors mb-6"
              >
                <span>{band.event_name}</span>
                <span className="text-text-dim">•</span>
                <span>{formatEventDate(band.date, band.timezone)}</span>
                <ExternalLinkIcon size={16} strokeWidth={2} />
              </Link>

              {/* Quick Stats - Only show if detailed scoring available */}
              {showDetailedBreakdown && canShowScores && bandScore && (
                <div className="flex flex-wrap gap-6">
                  <div>
                    <div className="text-3xl font-bold text-accent">
                      {totalScore.toFixed(1)}
                    </div>
                    <div className="text-xs tracking-widest uppercase text-text-dim">
                      Total Score
                    </div>
                  </div>
                  <div className="border-l border-white/10 pl-6">
                    <div className="text-3xl font-bold">
                      {bandScore.crowd_vote_count || 0}
                    </div>
                    <div className="text-xs tracking-widest uppercase text-text-dim">
                      Crowd Votes
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Band Description Section - show if description is longer than a company name */}
      {band.description && band.description.length > 50 && (
        <section className="py-12 bg-bg border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <p className="text-text-muted text-lg max-w-3xl">
              {band.description}
            </p>
          </div>
        </section>
      )}

      {/* Setlist Section - Only shown after event is finalized */}
      {canShowScores && <SetlistSection songs={setlist} />}

      {/* Score Breakdown - For detailed scoring versions (2025.1, 2026.1) */}
      {showDetailedBreakdown && canShowScores && bandScore && (
        <section className="py-16 bg-bg">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <h2 className="font-semibold text-3xl mb-8">Score Breakdown</h2>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Judge Scores Card */}
              <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs tracking-widest uppercase text-text-muted">
                    Judge Scores
                  </h3>
                  <span className="text-2xl font-semibold text-accent">
                    {judgeScore.toFixed(1)}
                    <span className="text-sm text-text-dim">
                      /{maxJudgePoints}
                    </span>
                  </span>
                </div>

                <div className="space-y-5">
                  <ScoreRow
                    emoji="🎵"
                    label="Song Choice"
                    value={Number(bandScore.avg_song_choice || 0)}
                    max={20}
                  />
                  <ScoreRow
                    emoji="🎤"
                    label="Performance"
                    value={Number(bandScore.avg_performance || 0)}
                    max={30}
                  />
                  <ScoreRow
                    emoji="🔥"
                    label="Crowd Vibe"
                    value={Number(bandScore.avg_crowd_vibe || 0)}
                    max={crowdVibeMax}
                  />
                  {scoringVersion === '2026.1' && (
                    <ScoreRow
                      emoji="🎨"
                      label="Visuals"
                      value={visualsScore}
                      max={20}
                    />
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 text-sm text-text-dim">
                  Based on {bandScore.judge_vote_count || 0} judge evaluations
                </div>
              </div>

              {/* Crowd Vote Card */}
              <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs tracking-widest uppercase text-text-muted">
                    Crowd Vote
                  </h3>
                  <span className="text-2xl font-semibold text-accent">
                    {Math.round(crowdVoteScore)}
                    <span className="text-sm text-text-dim">/10</span>
                  </span>
                </div>

                <div className="flex items-center gap-6">
                  <CircularProgress percent={crowdVotePercent} />
                  <div>
                    <div className="text-4xl font-semibold">
                      {bandScore.crowd_vote_count || 0}
                    </div>
                    <div className="text-sm text-text-muted">
                      votes received
                    </div>
                    <div className="text-xs text-text-dim mt-1">
                      out of {bandScore.total_crowd_votes || 0} total
                    </div>
                  </div>
                </div>

                {isHighestVoted && (
                  <div className="mt-6 pt-4 border-t border-white/5 text-sm text-accent">
                    🏆 Highest voted band
                  </div>
                )}
              </div>

              {/* Scream-o-Meter (2025.1) or Visuals Summary (2026.1) */}
              {scoringVersion === '2025.1' && (
                <ScreamOMeterCard
                  score={screamOMeterScore}
                  energy={bandScore.crowd_noise_energy}
                  peak={bandScore.crowd_noise_peak}
                />
              )}
              {scoringVersion === '2026.1' && (
                <VisualsSummaryCard
                  score={visualsScore}
                  judgeCount={bandScore.judge_vote_count}
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* Legacy Event Display (2022.1) - Only show winner card if this band won */}
      {!showDetailedBreakdown && canShowScores && isWinner && (
        <section className="py-16 bg-bg">
          <div className="max-w-4xl mx-auto px-6 lg:px-8">
            <div className="rounded-xl p-8 text-center bg-linear-to-r from-warning/20 via-warning/10 to-warning/20 border border-warning/30">
              <div className="text-5xl mb-4">🏆</div>
              <h2 className="text-3xl font-bold text-white mb-2">Champion</h2>
              <p className="text-lg text-text-muted">
                {band.name} won {band.event_name}!
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Event Status Message for Non-Admin Users */}
      {eventStatus !== 'finalized' && !isAdmin && (
        <section className="py-16 bg-bg">
          <div className="max-w-4xl mx-auto px-6 lg:px-8">
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-8 text-center">
              <div className="text-5xl mb-4">
                {eventStatus === 'upcoming' ? '📅' : '🎵'}
              </div>
              <h2 className="text-3xl font-bold text-warning mb-2">
                {eventStatus === 'upcoming'
                  ? 'Event Upcoming'
                  : 'Event In Progress'}
              </h2>
              <p className="text-lg text-text-muted">
                Scores will be available after the event is finalized
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Photos Section - filter by company + event */}
      <PhotoStrip
        eventId={eventId}
        companySlug={band.company_slug || undefined}
      />

      {/* Videos Section */}
      {videos.length > 0 && (
        <section className="py-12 border-t border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <VideoCarousel
              videos={videos}
              title="Videos"
              showBandInfo={false}
              location="band_page"
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
              showBandInfo={false}
              location="band_page"
            />
          </div>
        </section>
      )}

      {/* Band Navigation (Previous/Next) */}
      {(prevBand || nextBand) && (
        <BandNavigation prevBand={prevBand} nextBand={nextBand} />
      )}

      {/* Navigation/Actions Section */}
      <section className="py-16 bg-bg">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Social Links (if band has them) */}
            {band.info?.social_media && (
              <div className="flex flex-wrap gap-3">
                {band.info.social_media.twitter && (
                  <SocialIconLink
                    href={band.info.social_media.twitter}
                    platform="twitter"
                    label="Twitter"
                    location="band_page"
                    className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-5 py-3 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <TwitterIcon size={20} />
                    Twitter
                  </SocialIconLink>
                )}
                {band.info.social_media.instagram && (
                  <SocialIconLink
                    href={band.info.social_media.instagram}
                    platform="instagram"
                    label="Instagram"
                    location="band_page"
                    className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-5 py-3 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <InstagramIcon size={20} />
                    Instagram
                  </SocialIconLink>
                )}
                {band.info.social_media.facebook && (
                  <SocialIconLink
                    href={band.info.social_media.facebook}
                    platform="facebook"
                    label="Facebook"
                    location="band_page"
                    className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-5 py-3 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <FacebookIcon size={20} />
                    Facebook
                  </SocialIconLink>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3">
              <Link
                href={`/event/${eventId}`}
                className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-6 py-3 rounded-full text-sm tracking-widest uppercase flex items-center gap-2 transition-colors"
              >
                <ArrowLeftIcon size={16} strokeWidth={2} />
                Event
              </Link>
              {canShowScores && (
                <Link
                  href={`/results/${eventId}`}
                  className="bg-accent hover:bg-accent-light text-white px-6 py-3 rounded-full text-sm tracking-widest uppercase flex items-center gap-2 transition-colors"
                >
                  All Results
                  <ChevronRightIcon size={16} strokeWidth={2} />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// Scream-o-Meter Card Component (for 2025.1)
function ScreamOMeterCard({
  score,
  energy,
  peak,
}: {
  score: number
  energy?: number
  peak?: number
}) {
  const percent = (score / 10) * 100
  const hasData = score > 0

  return (
    <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs tracking-widest uppercase text-text-muted">
          Scream-o-Meter
        </h3>
        <span className="text-2xl font-semibold">
          {hasData ? score.toFixed(1) : 'N/A'}
          <span className="text-sm text-text-dim">/10</span>
        </span>
      </div>

      {hasData ? (
        <>
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-4xl">🔊</div>
              <div className="flex-1">
                <div className="h-4 bg-bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${percent}%`,
                      background: 'linear-gradient(90deg, #31eb14, #F5A623)',
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="text-center text-text-muted text-sm">
              {score >= 8
                ? 'Incredible crowd energy!'
                : score >= 6
                  ? 'Solid crowd energy'
                  : score >= 4
                    ? 'Moderate crowd energy'
                    : 'Building crowd energy'}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 text-sm text-text-dim">
            {energy ? `Energy: ${Number(energy).toFixed(2)}` : ''}
            {peak ? ` • Peak: ${Number(peak).toFixed(0)} dB` : ''}
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🔇</div>
          <p className="text-text-dim text-sm">
            No crowd noise measurement recorded
          </p>
        </div>
      )}
    </div>
  )
}

// Visuals Summary Card (for 2026.1)
function VisualsSummaryCard({
  score,
  judgeCount,
}: {
  score: number
  judgeCount?: number
}) {
  const percent = (score / 20) * 100

  return (
    <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs tracking-widest uppercase text-text-muted">
          Visual Presentation
        </h3>
        <span className="text-2xl font-semibold text-accent">
          {score.toFixed(1)}
          <span className="text-sm text-text-dim">/20</span>
        </span>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="text-4xl">🎨</div>
          <div className="flex-1">
            <div className="h-4 bg-bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-1000"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>
        <div className="text-center text-text-muted text-sm">
          {percent >= 80
            ? 'Exceptional stage presence'
            : percent >= 60
              ? 'Great visual impact'
              : percent >= 40
                ? 'Good presentation'
                : 'Basic presentation'}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-white/5 text-sm text-text-dim">
        Costumes, backdrops & themed presentation
        {judgeCount ? ` • ${judgeCount} judges` : ''}
      </div>
    </div>
  )
}

// Band Navigation Component (Previous/Next)
interface BandNavigationProps {
  prevBand: { id: string; name: string } | null
  nextBand: { id: string; name: string } | null
}

function BandNavigation({ prevBand, nextBand }: BandNavigationProps) {
  return (
    <section className="py-8 bg-bg border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Previous Band */}
          {prevBand ? (
            <Link
              href={`/band/${prevBand.id}`}
              className="group flex items-center gap-3 py-4 pr-4 text-left hover:text-accent transition-colors max-w-[45%]"
            >
              <ChevronLeftIcon
                size={20}
                className="shrink-0 text-text-muted group-hover:text-accent transition-colors"
                strokeWidth={2}
              />
              <div className="min-w-0">
                <div className="text-xs tracking-widest uppercase text-text-dim mb-1">
                  Previous
                </div>
                <div className="font-medium truncate">{prevBand.name}</div>
              </div>
            </Link>
          ) : (
            <div />
          )}

          {/* Next Band */}
          {nextBand ? (
            <Link
              href={`/band/${nextBand.id}`}
              className="group flex items-center gap-3 py-4 pl-4 text-right hover:text-accent transition-colors max-w-[45%]"
            >
              <div className="min-w-0">
                <div className="text-xs tracking-widest uppercase text-text-dim mb-1">
                  Next
                </div>
                <div className="font-medium truncate">{nextBand.name}</div>
              </div>
              <ChevronRightIcon
                size={20}
                className="shrink-0 text-text-muted group-hover:text-accent transition-colors"
                strokeWidth={2}
              />
            </Link>
          ) : (
            <div />
          )}
        </div>
      </div>
    </section>
  )
}
