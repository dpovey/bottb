'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Video } from '@/lib/db-types'
import { CompanyIcon } from '@/components/ui'
import { motion, AnimatePresence } from 'framer-motion'
import { trackVideoClick } from '@/lib/analytics'
import { YouTubeIcon, CloseIcon } from '@/components/icons'

interface ShortsGridProps {
  videos: Video[]
  className?: string
  location?: string // Where the grid appears (e.g., "videos_page")
}

/**
 * Get YouTube Short thumbnail URL
 * For Shorts (vertical video), we use hq720.jpg which preserves portrait aspect ratio
 * and provides 720p quality.
 */
function getThumbnailUrl(video: Video): string {
  if (video.thumbnail_url) {
    return video.thumbnail_url
  }
  // Use hq720.jpg for Shorts - it preserves the original aspect ratio (portrait for Shorts)
  return `https://i.ytimg.com/vi/${video.youtube_video_id}/hq720.jpg`
}

/**
 * Shorts Grid Component
 *
 * Displays YouTube Shorts in a grid layout with portrait aspect ratio (9:16).
 * Uses 5-6 columns on desktop to match the visual height of the regular video grid.
 */
export function ShortsGrid({
  videos,
  className = '',
  location = 'videos_page',
}: ShortsGridProps) {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)

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
    return (
      <div className="text-center py-12 text-text-muted">No shorts found.</div>
    )
  }

  return (
    <>
      {/* Shorts Grid - More columns for portrait cards */}
      <div
        className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 ${className}`}
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
            className="group text-left"
          >
            {/* Thumbnail - Portrait 9:16 aspect ratio */}
            <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-bg-elevated border border-white/5 group-hover:border-white/20 transition-all duration-300">
              <Image
                src={getThumbnailUrl(video)}
                alt={video.title}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
                className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
                loading="lazy"
              />

              {/* YouTube Shorts Icon */}
              <div className="absolute top-2 left-2 bg-black/60 rounded-full p-1.5">
                <YouTubeIcon size={16} className="text-white" />
              </div>

              {/* Shorts badge */}
              <div className="absolute bottom-2 right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                SHORTS
              </div>

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>

            {/* Video Info */}
            <div className="mt-2">
              <h3 className="font-medium text-sm line-clamp-2 group-hover:text-accent transition-colors">
                {video.title}
              </h3>
              <div className="mt-1 flex items-center gap-1.5 text-text-muted text-xs">
                {video.company_icon_url && (
                  <CompanyIcon
                    iconUrl={video.company_icon_url}
                    companyName={video.company_name || ''}
                    size="xs"
                    showFallback={false}
                  />
                )}
                {video.band_name && (
                  <span className="truncate">{video.band_name}</span>
                )}
                {video.event_name && !video.band_name && (
                  <span className="truncate">{video.event_name}</span>
                )}
              </div>
            </div>
          </button>
        ))}
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
              {/* Close Button */}
              <button
                onClick={() => setSelectedVideo(null)}
                className="absolute -top-12 right-0 p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                aria-label="Close video"
              >
                <CloseIcon size={24} />
              </button>

              {/* Video Player - Portrait aspect ratio for Shorts */}
              <div className="relative aspect-[9/16] bg-black rounded-xl overflow-hidden">
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
