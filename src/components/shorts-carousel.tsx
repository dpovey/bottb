'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { Video } from '@/lib/db-types'
import { CompanyIcon } from '@/components/ui'
import { motion, AnimatePresence } from 'framer-motion'
import { trackVideoClick, trackSubscribeClick } from '@/lib/analytics'
import {
  YouTubeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
} from '@/components/icons'

interface ShortsCarouselProps {
  videos: Video[]
  title?: string
  showBandInfo?: boolean
  className?: string
  location?: string // Where the carousel appears (e.g., "home_page", "event_page", "band_page")
}

/**
 * Get YouTube Short thumbnail URL
 * For Shorts (vertical video), we use hq720.jpg which preserves portrait aspect ratio
 * and provides 720p quality. Falls back to maxresdefault.jpg if needed.
 */
function getThumbnailUrl(video: Video): string {
  if (video.thumbnail_url) {
    return video.thumbnail_url
  }
  // Use hq720.jpg for Shorts - it preserves the original aspect ratio (portrait for Shorts)
  // and provides 720p quality (1280x720 for landscape, or portrait equivalent)
  return `https://i.ytimg.com/vi/${video.youtube_video_id}/hq720.jpg`
}

/**
 * Shorts Carousel Component
 *
 * Displays a horizontal scrolling carousel of YouTube Shorts thumbnails.
 * Shorts are displayed in portrait aspect ratio (9:16).
 * Clicking a thumbnail opens a modal with the embedded YouTube Short player.
 */
export function ShortsCarousel({
  videos,
  title = 'Shorts',
  showBandInfo = true,
  className = '',
  location = 'shorts_carousel',
}: ShortsCarouselProps) {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Check scroll state
  const checkScrollState = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollLeft, scrollWidth, clientWidth } = container
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1)
  }, [])

  useEffect(() => {
    checkScrollState()
    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener('scroll', checkScrollState)
      window.addEventListener('resize', checkScrollState)
      return () => {
        container.removeEventListener('scroll', checkScrollState)
        window.removeEventListener('resize', checkScrollState)
      }
    }
  }, [checkScrollState, videos])

  // Scroll handlers
  const scroll = useCallback((direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return

    const scrollAmount = container.clientWidth * 0.8
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }, [])

  // Close modal on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedVideo) {
        setSelectedVideo(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedVideo])

  if (videos.length === 0) {
    return null
  }

  return (
    <>
      <div className={className}>
        {/* Header with title and navigation */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-2xl sm:text-3xl">{title}</h2>

          <div className="flex items-center gap-3">
            {/* Subscribe link */}
            <a
              href="https://youtube.com/@battleofthetechbands?sub_confirmation=1&utm_source=bottb&utm_medium=website&utm_campaign=shorts-carousel"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackSubscribeClick({
                  location,
                  url: 'https://youtube.com/@battleofthetechbands?sub_confirmation=1',
                })
              }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-text-muted hover:text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all"
            >
              <YouTubeIcon size={16} />
              Subscribe
            </a>

            {/* Navigation Arrows */}
            {videos.length > 4 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => scroll('left')}
                  disabled={!canScrollLeft}
                  className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center text-white hover:border-white/60 hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Scroll left"
                >
                  <ChevronLeftIcon size={20} strokeWidth={2} />
                </button>
                <button
                  onClick={() => scroll('right')}
                  disabled={!canScrollRight}
                  className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center text-white hover:border-white/60 hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Scroll right"
                >
                  <ChevronRightIcon size={20} strokeWidth={2} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Shorts Cards Carousel - Portrait aspect ratio */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent snap-x snap-mandatory"
          style={{ scrollbarWidth: 'thin' }}
        >
          {videos.map((video) => (
            <button
              key={video.id}
              onClick={() => {
                setSelectedVideo(video)
                trackVideoClick({
                  video_id: video.id,
                  video_title: video.title,
                  youtube_video_id: video.youtube_video_id,
                  event_id: video.event_id || null,
                  band_id: video.band_id || null,
                  event_name: video.event_name || null,
                  band_name: video.band_name || null,
                  company_name: video.company_name || null,
                  location,
                })
              }}
              className="group shrink-0 w-[140px] sm:w-[160px] snap-start"
            >
              {/* Thumbnail - Portrait 9:16 aspect ratio */}
              <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-bg-elevated border border-white/5 group-hover:border-white/20 transition-colors">
                <Image
                  src={getThumbnailUrl(video)}
                  alt={video.title}
                  fill
                  sizes="(max-width: 640px) 140px, 160px"
                  className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
                  loading="lazy"
                />

                {/* YouTube Shorts Icon */}
                <div className="absolute top-2 left-2 bg-black/60 rounded-full p-1.5">
                  <YouTubeIcon size={16} className="text-white" />
                </div>
              </div>

              {/* Video Info */}
              <div className="mt-2 text-left">
                <h3 className="font-medium text-xs line-clamp-2 group-hover:text-accent transition-colors">
                  {video.title}
                </h3>
                {showBandInfo && video.band_name && (
                  <div className="mt-1 flex items-center gap-1 text-text-muted text-[10px]">
                    {video.company_icon_url && (
                      <CompanyIcon
                        iconUrl={video.company_icon_url}
                        companyName={video.company_name || ''}
                        size="xs"
                        showFallback={false}
                      />
                    )}
                    <span className="truncate">{video.band_name}</span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Video Modal - Portrait orientation for Shorts */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90"
            onClick={() => setSelectedVideo(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="relative w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Video Player - Portrait aspect ratio for Shorts */}
              <div className="relative aspect-[9/16] bg-black rounded-xl overflow-hidden">
                {/* Close Button - inside video on mobile (lower to clear Safari header), above on larger screens */}
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="absolute top-14 right-2 md:-top-12 md:right-0 z-10 p-2 rounded-lg bg-black/50 md:bg-transparent hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  aria-label="Close video"
                >
                  <CloseIcon size={24} />
                </button>
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${selectedVideo.youtube_video_id}?autoplay=1&rel=0`}
                  title={selectedVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>

              {/* Video Info */}
              <div className="mt-4">
                <h3 className="font-semibold text-lg">{selectedVideo.title}</h3>
                {selectedVideo.band_name && (
                  <div className="mt-2 flex items-center gap-2 text-text-muted text-sm">
                    {selectedVideo.company_icon_url && (
                      <CompanyIcon
                        iconUrl={selectedVideo.company_icon_url}
                        companyName={selectedVideo.company_name || ''}
                        size="sm"
                        showFallback={false}
                      />
                    )}
                    <span>{selectedVideo.band_name}</span>
                    {selectedVideo.company_name && (
                      <>
                        <span className="text-text-dim">•</span>
                        <span className="text-text-dim">
                          {selectedVideo.company_name}
                        </span>
                      </>
                    )}
                  </div>
                )}
                {selectedVideo.event_name && (
                  <p className="mt-1 text-text-dim text-sm">
                    {selectedVideo.event_name}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
