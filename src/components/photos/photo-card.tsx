'use client'

import { useState } from 'react'
import { Photo } from '@/lib/db-types'
import { CompanyIcon } from '@/components/ui'
import { LayersIcon } from '@/components/icons'
import { buildThumbnailSrcSet, getBestThumbnailSrc } from '@/lib/photo-srcset'

/**
 * Cluster data for grouped photos
 */
export interface PhotoClusterData {
  /** All photos in this cluster */
  photos: Photo[]
  /** Current index being displayed */
  currentIndex: number
}

interface PhotoCardProps {
  photo: Photo
  onClick: () => void
  showCompanyLogo?: boolean
  /** Optional cluster data when this photo is part of a group */
  cluster?: PhotoClusterData
  /** Callback when cycling through cluster photos */
  onCyclePhoto?: (newIndex: number) => void
}

export function PhotoCard({
  photo,
  onClick,
  showCompanyLogo = true,
  cluster,
  onCyclePhoto,
}: PhotoCardProps) {
  // Local state for crossfade animation
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Determine which photo to display (cluster photo or original)
  const displayPhoto = cluster ? cluster.photos[cluster.currentIndex] : photo

  // Use best available thumbnail with responsive srcset
  const thumbSrc = getBestThumbnailSrc(displayPhoto)
  const srcSet = buildThumbnailSrcSet(displayPhoto)
  // Use smart focal point for intelligent cropping (defaults to center)
  const focalPoint = displayPhoto.hero_focal_point ?? { x: 50, y: 50 }

  // Handle cycling through cluster photos
  const handleCycleClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering onClick
    if (!cluster || !onCyclePhoto) return

    // Trigger transition animation
    setIsTransitioning(true)
    setTimeout(() => setIsTransitioning(false), 200)

    // Cycle to next photo (wrap around)
    const nextIndex = (cluster.currentIndex + 1) % cluster.photos.length
    onCyclePhoto(nextIndex)
  }

  const clusterSize = cluster?.photos.length ?? 0
  const showClusterBadge = clusterSize > 1

  return (
    <div
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-bg-elevated transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)]"
      onClick={onClick}
    >
      {/* Thumbnail with responsive srcSet for crisp display on all devices */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={thumbSrc}
        src={thumbSrc}
        srcSet={srcSet}
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        alt={displayPhoto.original_filename || 'Photo'}
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 motion-safe:group-hover:scale-110 ${
          isTransitioning ? 'opacity-70' : 'opacity-100'
        }`}
        style={{ objectPosition: `${focalPoint.x}% ${focalPoint.y}%` }}
        loading="lazy"
      />

      {/* Cluster badge - top left corner */}
      {showClusterBadge && (
        <button
          onClick={handleCycleClick}
          className="absolute top-2 left-2 p-1.5 bg-black/70 backdrop-blur-xs rounded-lg flex items-center gap-1 text-white/90 hover:text-white hover:bg-black/80 transition-all z-10 cursor-pointer"
          title={`${clusterSize} similar photos – click to cycle`}
          aria-label={`View ${clusterSize} similar photos`}
        >
          <LayersIcon size={14} />
          <span className="text-xs font-medium">{clusterSize}</span>
        </button>
      )}

      {/* Company icon badge - always visible in top right if available */}
      {showCompanyLogo && displayPhoto.company_icon_url && (
        <div className="absolute top-2 right-2 p-1.5 bg-black/60 backdrop-blur-xs rounded-lg opacity-80 group-hover:opacity-100 transition-opacity">
          <CompanyIcon
            iconUrl={displayPhoto.company_icon_url}
            companyName={displayPhoto.company_name || 'Company'}
            size="sm"
            showFallback={false}
          />
        </div>
      )}

      {/* Hover overlay with info */}
      <div className="absolute inset-0 bg-linear-to-t from-bg via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute bottom-0 left-0 right-0 p-3">
          {displayPhoto.band_name && (
            <div className="flex items-center gap-2">
              {/* Show company icon next to band name if no top-right icon */}
              {!displayPhoto.company_icon_url && displayPhoto.company_name && (
                <CompanyIcon
                  iconUrl={displayPhoto.company_icon_url}
                  companyName={displayPhoto.company_name}
                  size="xs"
                  showFallback={false}
                />
              )}
              <p className="text-sm font-medium text-white truncate">
                {displayPhoto.band_name}
              </p>
            </div>
          )}
          {displayPhoto.event_name && (
            <p className="text-xs text-text-muted truncate">
              {displayPhoto.event_name}
            </p>
          )}
        </div>
      </div>

      {/* Accent border on hover */}
      <div className="absolute inset-0 rounded-lg border-2 border-accent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  )
}
