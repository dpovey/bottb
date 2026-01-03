'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Photo } from '@/lib/db-types'
import { CompanyIcon } from '@/components/ui'
import { LayersIcon } from '@/components/icons'
import { buildThumbnailSrcSet, getBestThumbnailSrc } from '@/lib/photo-srcset'

/** Auto-cycle interval in milliseconds */
const AUTO_CYCLE_INTERVAL = 1000

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
  const [isHovered, setIsHovered] = useState(false)
  const autoCycleRef = useRef<NodeJS.Timeout | null>(null)

  // Determine which photo to display (cluster photo or original)
  const displayPhoto = cluster ? cluster.photos[cluster.currentIndex] : photo

  // Filter cluster photos by same color type for cycling
  // If current photo is B&W, only cycle through B&W photos; same for color
  const sameColorPhotos = useMemo(() => {
    if (!cluster) return []

    const currentIsMonochrome = displayPhoto.is_monochrome

    // If is_monochrome is null (not yet classified), include all photos
    if (currentIsMonochrome === null || currentIsMonochrome === undefined) {
      return cluster.photos
    }

    // Filter to same color type
    return cluster.photos.filter(
      (p) =>
        p.is_monochrome === currentIsMonochrome ||
        p.is_monochrome === null ||
        p.is_monochrome === undefined
    )
  }, [cluster, displayPhoto.is_monochrome])

  // Auto-cycle through same-color photos
  useEffect(() => {
    // Only auto-cycle if there are multiple same-color photos and not hovered
    if (sameColorPhotos.length <= 1 || !cluster || !onCyclePhoto || isHovered) {
      return
    }

    autoCycleRef.current = setInterval(() => {
      // Find current position in same-color photos
      const currentSameColorIndex = sameColorPhotos.findIndex(
        (p) => p.id === displayPhoto.id
      )
      // Get next same-color photo
      const nextSameColorIndex =
        (currentSameColorIndex + 1) % sameColorPhotos.length
      const nextPhoto = sameColorPhotos[nextSameColorIndex]

      // Find the index in the full cluster array
      const nextClusterIndex = cluster.photos.findIndex(
        (p) => p.id === nextPhoto.id
      )

      if (
        nextClusterIndex !== -1 &&
        nextClusterIndex !== cluster.currentIndex
      ) {
        // Trigger transition animation
        setIsTransitioning(true)
        setTimeout(() => setIsTransitioning(false), 200)
        onCyclePhoto(nextClusterIndex)
      }
    }, AUTO_CYCLE_INTERVAL)

    return () => {
      if (autoCycleRef.current) {
        clearInterval(autoCycleRef.current)
      }
    }
  }, [sameColorPhotos, cluster, displayPhoto.id, onCyclePhoto, isHovered])

  // Use best available thumbnail with responsive srcset
  const thumbSrc = getBestThumbnailSrc(displayPhoto)
  const srcSet = buildThumbnailSrcSet(displayPhoto)
  // Use smart focal point for intelligent cropping (defaults to center)
  const focalPoint = displayPhoto.hero_focal_point ?? { x: 50, y: 50 }

  // Handle manual cycling through cluster photos (on click)
  const handleCycleClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering onClick
    if (!cluster || !onCyclePhoto) return

    // Trigger transition animation
    setIsTransitioning(true)
    setTimeout(() => setIsTransitioning(false), 200)

    // Cycle to next same-color photo manually
    const currentSameColorIndex = sameColorPhotos.findIndex(
      (p) => p.id === displayPhoto.id
    )
    const nextSameColorIndex =
      (currentSameColorIndex + 1) % sameColorPhotos.length
    const nextPhoto = sameColorPhotos[nextSameColorIndex]
    const nextClusterIndex = cluster.photos.findIndex(
      (p) => p.id === nextPhoto.id
    )

    if (nextClusterIndex !== -1) {
      onCyclePhoto(nextClusterIndex)
    }
  }

  // Show same-color count in badge instead of total cluster size
  const sameColorCount = sameColorPhotos.length
  const showClusterBadge = sameColorCount > 1

  return (
    <div
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-bg-elevated transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)]"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
          title={`${sameColorCount} similar photos – auto-cycling, click to skip`}
          aria-label={`View ${sameColorCount} similar photos`}
        >
          <LayersIcon size={14} />
          <span className="text-xs font-medium">{sameColorCount}</span>
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
