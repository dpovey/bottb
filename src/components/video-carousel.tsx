"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Video } from "@/lib/db";
import { CompanyIcon } from "@/components/ui";
import { motion, AnimatePresence } from "framer-motion";

interface VideoCarouselProps {
  videos: Video[];
  title?: string;
  showBandInfo?: boolean;
  className?: string;
}

/**
 * Format duration in seconds to MM:SS or H:MM:SS
 */
function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Get YouTube thumbnail URL with fallback
 */
function getThumbnailUrl(video: Video): string {
  if (video.thumbnail_url) {
    return video.thumbnail_url;
  }
  // Fallback to YouTube's thumbnail API
  return `https://img.youtube.com/vi/${video.youtube_video_id}/maxresdefault.jpg`;
}

/**
 * Video Carousel Component
 * 
 * Displays a horizontal scrolling carousel of YouTube video thumbnails.
 * Clicking a thumbnail opens a modal with the embedded YouTube player.
 */
export function VideoCarousel({
  videos,
  title = "Videos",
  showBandInfo = true,
  className = "",
}: VideoCarouselProps) {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll state
  const checkScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    checkScrollState();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", checkScrollState);
      window.addEventListener("resize", checkScrollState);
      return () => {
        container.removeEventListener("scroll", checkScrollState);
        window.removeEventListener("resize", checkScrollState);
      };
    }
  }, [checkScrollState, videos]);

  // Scroll handlers
  const scroll = useCallback((direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  }, []);

  // Close modal on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedVideo) {
        setSelectedVideo(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedVideo]);

  if (videos.length === 0) {
    return null;
  }

  return (
    <>
      <div className={className}>
        {/* Header with title and navigation */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-2xl sm:text-3xl">{title}</h2>
          
          {/* Navigation Arrows */}
          {videos.length > 2 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => scroll("left")}
                disabled={!canScrollLeft}
                className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center text-white hover:border-white/60 hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Scroll left"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => scroll("right")}
                disabled={!canScrollRight}
                className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center text-white hover:border-white/60 hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Scroll right"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Video Cards Carousel */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent snap-x snap-mandatory"
          style={{ scrollbarWidth: "thin" }}
        >
          {videos.map((video) => (
            <button
              key={video.id}
              onClick={() => setSelectedVideo(video)}
              className="group shrink-0 w-[280px] sm:w-[320px] snap-start"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video rounded-lg overflow-hidden bg-bg-elevated border border-white/5 group-hover:border-white/20 transition-colors">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getThumbnailUrl(video)}
                  alt={video.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                
                {/* Duration Badge */}
                {video.duration_seconds && (
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-xs font-medium">
                    {formatDuration(video.duration_seconds)}
                  </div>
                )}

                {/* YouTube Icon */}
                <div className="absolute top-2 left-2">
                  <svg className="w-6 h-6 text-white/70" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </div>
              </div>

              {/* Video Info */}
              <div className="mt-3 text-left">
                <h3 className="font-medium text-sm line-clamp-2 group-hover:text-accent transition-colors">
                  {video.title}
                </h3>
                {showBandInfo && video.band_name && (
                  <div className="mt-1 flex items-center gap-2 text-text-muted text-xs">
                    {video.company_icon_url && (
                      <CompanyIcon
                        iconUrl={video.company_icon_url}
                        companyName={video.company_name || ""}
                        size="xs"
                        showFallback={false}
                      />
                    )}
                    <span className="truncate">{video.band_name}</span>
                    {video.event_name && (
                      <>
                        <span className="text-text-dim">•</span>
                        <span className="truncate text-text-dim">{video.event_name}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Video Modal */}
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
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="relative w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedVideo(null)}
                className="absolute -top-12 right-0 p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                aria-label="Close video"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Video Player */}
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
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
                <h3 className="font-semibold text-xl">{selectedVideo.title}</h3>
                {selectedVideo.band_name && (
                  <div className="mt-2 flex items-center gap-2 text-text-muted text-sm">
                    {selectedVideo.company_icon_url && (
                      <CompanyIcon
                        iconUrl={selectedVideo.company_icon_url}
                        companyName={selectedVideo.company_name || ""}
                        size="sm"
                        showFallback={false}
                      />
                    )}
                    <span>{selectedVideo.band_name}</span>
                    {selectedVideo.company_name && (
                      <>
                        <span className="text-text-dim">•</span>
                        <span className="text-text-dim">{selectedVideo.company_name}</span>
                      </>
                    )}
                  </div>
                )}
                {selectedVideo.event_name && (
                  <p className="mt-1 text-text-dim text-sm">{selectedVideo.event_name}</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

