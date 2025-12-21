'use client'

import Image from 'next/image'
import { Card, Badge, BandThumbnail, CompanyBadge } from '@/components/ui'
import { ScoringVersion, hasDetailedBreakdown } from '@/lib/scoring'

/**
 * Get object-position for the focal point.
 */
function getObjectPosition(focalPoint: { x: number; y: number }) {
  return `${focalPoint.x}% ${focalPoint.y}%`
}

export interface WinnerDisplayProps {
  /** Name of the winning band */
  winnerName: string
  /** Company slug for linking */
  companySlug?: string
  /** Company name */
  companyName?: string
  /** Company icon URL */
  companyIconUrl?: string
  /** @deprecated Use companySlug/companyName instead */
  company?: string
  /** Total score (only shown for detailed breakdown versions) */
  totalScore?: number
  /** Logo URL for the band */
  logoUrl?: string
  /** Hero thumbnail URL for the band */
  heroThumbnailUrl?: string
  /** Focal point for hero image positioning (0-100 for both x and y) */
  heroFocalPoint?: { x: number; y: number }
  /** Scoring version */
  scoringVersion: ScoringVersion
  /** Event name */
  eventName?: string
  /** Event date */
  eventDate?: string
  /** Event location */
  eventLocation?: string
}

export function WinnerDisplay({
  winnerName,
  companySlug,
  companyName,
  companyIconUrl,
  company,
  totalScore,
  logoUrl,
  heroThumbnailUrl,
  heroFocalPoint = { x: 50, y: 50 },
  scoringVersion,
  eventName,
  eventDate,
  eventLocation,
}: WinnerDisplayProps) {
  const showScore =
    hasDetailedBreakdown(scoringVersion) && totalScore !== undefined

  return (
    <div className="relative">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-linear-to-r from-warning/20 via-warning/10 to-warning/20 rounded-3xl blur-2xl" />

      <Card
        className="relative overflow-hidden bg-bg-elevated border-warning/30 p-0"
        style={{
          boxShadow:
            '0 0 60px rgba(245, 166, 35, 0.3), 0 0 100px rgba(245, 166, 35, 0.1)',
        }}
      >
        {/* Hero Image - Full Background */}
        {heroThumbnailUrl && (
          <div className="absolute inset-0">
            <Image
              src={heroThumbnailUrl}
              alt={`${winnerName} performing`}
              fill
              className="object-cover"
              style={{ objectPosition: getObjectPosition(heroFocalPoint) }}
              sizes="(max-width: 768px) 100vw, 80vw"
            />
            {/* Gradient overlay - fade from left */}
            <div className="absolute inset-0 bg-linear-to-r from-bg-elevated via-bg-elevated/80 via-40% to-transparent" />
          </div>
        )}

        {/* Content - Left aligned */}
        <div className="relative py-12 px-8 md:px-12 md:max-w-md lg:max-w-lg">
          {/* Trophy */}
          <div className="text-6xl mb-4">🏆</div>

          {/* Label */}
          <Badge variant="warning" className="mb-4">
            {scoringVersion === '2022.1' ? 'Winner' : 'Champion'}
          </Badge>

          {/* Winner Name */}
          <h2 className="text-3xl lg:text-4xl font-semibold text-white mb-4">
            {winnerName}
          </h2>

          {/* Company/Logo */}
          {(companySlug || company || logoUrl) && (
            <div className="flex items-center gap-3 mb-6">
              {logoUrl && (
                <BandThumbnail
                  logoUrl={logoUrl}
                  bandName={winnerName}
                  size="md"
                />
              )}
              {companySlug && companyName ? (
                <span className="text-text-muted flex items-center gap-2">
                  representing{' '}
                  <CompanyBadge
                    slug={companySlug}
                    name={companyName}
                    iconUrl={companyIconUrl}
                    variant="default"
                    size="md"
                  />
                </span>
              ) : (
                company && (
                  <span className="text-text-muted">
                    representing {company}
                  </span>
                )
              )}
            </div>
          )}

          {/* Score (only for detailed breakdown versions) */}
          {showScore && (
            <div className="inline-flex items-baseline gap-1">
              <span className="text-5xl lg:text-6xl font-bold text-warning">
                {totalScore.toFixed(1)}
              </span>
              <span className="text-xl text-text-muted">/ 100 points</span>
            </div>
          )}

          {/* Event info for 2022.1 single winner display */}
          {!showScore && eventName && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-text-muted">
                {eventName}
                {eventDate && ` • ${eventDate}`}
                {eventLocation && ` • ${eventLocation}`}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
