'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Photo } from '@/lib/db-types'
import { buildThumbnailSrcSet, getBestThumbnailSrc } from '@/lib/photo-srcset'
import { trackPhotoClick } from '@/lib/analytics'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'
import { Skeleton, VinylSpinner } from '@/components/ui'
import { useShuffledPhotos } from '@/lib/hooks/use-shuffled-photos'

interface PhotoStripProps {
  /** Filter by event ID */
  eventId?: string
  /** Filter by band ID */
  bandId?: string
  /** Filter by company slug */
  companySlug?: string
  /** Filter by photographer name */
  photographer?: string
  /** Custom title for the section (default: "Photos") */
  title?: string
  /** Link to full gallery with filters applied */
  viewAllLink?: string
  /** Custom class for the container */
  className?: string
  /** Enable slideshow on photo click (default: true) */
  enableSlideshow?: boolean
  /** Initial photos fetched server-side (optional) */
  initialPhotos?: Photo[]
  /** Initial total count fetched server-side (optional) */
  initialTotalCount?: number
}

const PAGE_SIZE = 50
const PREFETCH_THRESHOLD = 10 // Prefetch when within 10 photos of edge

export function PhotoStrip({
  eventId,
  bandId,
  companySlug,
  photographer,
  title = 'Photos',
  viewAllLink,
  className = '',
  enableSlideshow = true,
  initialPhotos,
  initialTotalCount,
}: PhotoStripProps) {
  const router = useRouter()

  // Use the unified hook for photo fetching and shuffle management
  const {
    photos,
    totalCount,
    shuffle,
    loading,
    loadingMore,
    loadMore,
    hasMore,
    buildSlideshowUrl,
  } = useShuffledPhotos({
    eventId,
    bandId,
    photographer,
    companySlug,
    initialShuffle: 'true', // Photo strips always default to shuffled
    pageSize: PAGE_SIZE,
    initialPhotos,
    initialTotalCount,
  })

  // Strip navigation state
  const [selectedIndex, setSelectedIndex] = useState(0)
  const stripRef = useRef<HTMLDivElement>(null)
  const photoRefs = useRef<(HTMLButtonElement | null)[]>([])
  const isInitialMount = useRef(true)

  // Build the view all link based on filters (includes shuffle seed for consistent ordering)
  const galleryLink = useMemo(() => {
    if (viewAllLink) return viewAllLink

    const params = new URLSearchParams()
    if (eventId) params.set('event', eventId)
    if (bandId) params.set('band', bandId)
    if (companySlug) params.set('company', companySlug)
    if (photographer) params.set('photographer', photographer)
    // Include shuffle seed so gallery shows same order as strip
    if (shuffle.seed) params.set('shuffle', shuffle.seed)
    return `/photos${params.toString() ? `?${params.toString()}` : ''}`
  }, [viewAllLink, eventId, bandId, companySlug, photographer, shuffle.seed])

  // Check if we need to prefetch based on selected index
  useEffect(() => {
    if (selectedIndex >= photos.length - PREFETCH_THRESHOLD && hasMore) {
      loadMore()
    }
  }, [selectedIndex, photos.length, hasMore, loadMore])

  // Auto-scroll to keep selected photo visible
  useEffect(() => {
    // Skip scrollIntoView on initial mount to prevent page scroll
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const photo = photoRefs.current[selectedIndex]
    if (photo && stripRef.current) {
      // Only scroll if the strip container is in the viewport
      const rect = stripRef.current.getBoundingClientRect()
      const isInViewport = rect.top < window.innerHeight && rect.bottom > 0

      if (isInViewport) {
        photo.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        })
      }
    }
  }, [selectedIndex])

  // Handle photo click - navigate to slideshow
  const handlePhotoClick = useCallback(
    (index: number) => {
      if (!enableSlideshow) return

      const photo = photos[index]
      if (!photo) return

      // Track photo click
      trackPhotoClick({
        photo_id: photo.id,
        event_id: photo.event_id || null,
        band_id: photo.band_id || null,
        event_name: photo.event_name || null,
        band_name: photo.band_name || null,
      })

      setSelectedIndex(index)

      // Use the type-safe URL builder from the hook
      const slideshowUrl = buildSlideshowUrl(photo.id)
      router.push(slideshowUrl)
    },
    [enableSlideshow, photos, router, buildSlideshowUrl]
  )

  // Keyboard navigation - works when strip or any of its children has focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if the strip container or any element inside it has focus
      const activeElement = document.activeElement
      if (!stripRef.current?.contains(activeElement)) {
        return
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        const nextIndex = Math.min(selectedIndex + 1, photos.length - 1)
        setSelectedIndex(nextIndex)
        photoRefs.current[nextIndex]?.focus()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        const prevIndex = Math.max(selectedIndex - 1, 0)
        setSelectedIndex(prevIndex)
        photoRefs.current[prevIndex]?.focus()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handlePhotoClick(selectedIndex)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [photos.length, selectedIndex, handlePhotoClick])

  // Don't render anything if there are no photos
  if (!loading && photos.length === 0) {
    return null
  }

  return (
    <>
      <section className={`py-16 bg-bg-elevated ${className}`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-semibold text-3xl">
              {title}
              {totalCount > 0 && (
                <span className="text-text-muted text-lg font-normal ml-3">
                  {totalCount} photo{totalCount !== 1 ? 's' : ''}
                </span>
              )}
            </h2>
            {totalCount > 0 && (
              <Link
                href={galleryLink}
                className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-5 py-2 rounded-full text-xs tracking-widest uppercase flex items-center gap-2 transition-colors"
              >
                All
                <ChevronRightIcon size={16} strokeWidth={2} />
              </Link>
            )}
          </div>

          {loading ? (
            // Loading skeleton
            <div className="flex gap-4 overflow-hidden px-2 py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 shrink-0"
                />
              ))}
            </div>
          ) : (
            <div className="relative">
              {/* Left chevron button */}
              {selectedIndex > 0 && (
                <button
                  onClick={() =>
                    setSelectedIndex((prev) => Math.max(prev - 1, 0))
                  }
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 md:w-12 md:h-12 rounded-full bg-bg/90 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors shadow-lg"
                  aria-label="Previous photo"
                >
                  <ChevronLeftIcon
                    size={20}
                    className="md:w-6 md:h-6"
                    strokeWidth={2}
                  />
                </button>
              )}

              {/* Right chevron button */}
              {(selectedIndex < photos.length - 1 || hasMore) && (
                <button
                  onClick={() =>
                    setSelectedIndex((prev) =>
                      Math.min(prev + 1, photos.length - 1)
                    )
                  }
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 md:w-12 md:h-12 rounded-full bg-bg/90 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors shadow-lg"
                  aria-label="Next photo"
                >
                  <ChevronRightIcon
                    size={20}
                    className="md:w-6 md:h-6"
                    strokeWidth={2}
                  />
                </button>
              )}

              {/* Scrollable strip with padding for ring visibility */}
              <div
                ref={stripRef}
                className="flex gap-4 overflow-x-auto px-2 py-3 -mx-2 scrollbar-thin scrollbar-track-bg scrollbar-thumb-white/20 hover:scrollbar-thumb-white/40 focus:outline-hidden"
                style={{ scrollbarWidth: 'thin' }}
                tabIndex={0}
                role="listbox"
                aria-label="Photo gallery - use arrow keys to navigate, Enter to open"
              >
                {photos.map((photo, index) => (
                  <button
                    key={`${photo.id}-${index}`}
                    ref={(el) => {
                      photoRefs.current[index] = el
                    }}
                    onClick={() => handlePhotoClick(index)}
                    onFocus={() => setSelectedIndex(index)}
                    className="relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 shrink-0 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 opacity-80 hover:opacity-100 focus:opacity-100 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-elevated outline-hidden"
                    aria-label={`Photo ${index + 1} of ${totalCount}`}
                    aria-selected={index === selectedIndex}
                    role="option"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getBestThumbnailSrc(photo)}
                      srcSet={buildThumbnailSrcSet(photo)}
                      sizes="(max-width: 640px) 192px, (max-width: 768px) 224px, 256px"
                      alt={photo.original_filename || `Photo ${index + 1}`}
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{
                        objectPosition: `${photo.hero_focal_point?.x ?? 50}% ${photo.hero_focal_point?.y ?? 50}%`,
                      }}
                      loading={index < 4 ? 'eager' : 'lazy'}
                    />
                  </button>
                ))}

                {/* Loading indicator at end */}
                {loadingMore && (
                  <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 shrink-0 rounded-lg bg-bg flex items-center justify-center">
                    <VinylSpinner size="xs" className="text-text-dim" />
                  </div>
                )}

                {/* More photos indicator */}
                {hasMore && !loadingMore && (
                  <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 shrink-0 rounded-lg bg-bg/50 flex items-center justify-center text-text-dim">
                    <span className="text-lg font-medium">
                      +{totalCount - photos.length} more
                    </span>
                  </div>
                )}
              </div>

              {/* Position indicator */}
              {photos.length > 0 && (
                <div className="mt-2 text-sm text-text-dim text-center">
                  {selectedIndex + 1} / {totalCount}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
