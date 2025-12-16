"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Photo } from "@/lib/db";
import { PhotoSlideshow } from "./photo-slideshow";

interface PhotoStripProps {
  /** Filter by event ID */
  eventId?: string;
  /** Filter by band ID */
  bandId?: string;
  /** Filter by company slug */
  companySlug?: string;
  /** Filter by photographer name */
  photographer?: string;
  /** Custom title for the section (default: "Photos") */
  title?: string;
  /** Link to full gallery with filters applied */
  viewAllLink?: string;
  /** Custom class for the container */
  className?: string;
  /** Enable slideshow on photo click (default: true) */
  enableSlideshow?: boolean;
}

interface PhotosResponse {
  photos: Photo[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const PAGE_SIZE = 50;
const PREFETCH_THRESHOLD = 10; // Prefetch when within 10 photos of edge

export function PhotoStrip({
  eventId,
  bandId,
  companySlug,
  photographer,
  title = "Photos",
  viewAllLink,
  className = "",
  enableSlideshow = true,
}: PhotoStripProps) {
  // All loaded photos for the strip
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Strip navigation state
  const [selectedIndex, setSelectedIndex] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);
  const photoRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Slideshow state
  const [slideshowIndex, setSlideshowIndex] = useState<number | null>(null);

  // Build the view all link based on filters
  const galleryLink = viewAllLink || (() => {
    const params = new URLSearchParams();
    if (eventId) params.set("event", eventId);
    if (bandId) params.set("band", bandId);
    if (companySlug) params.set("company", companySlug);
    if (photographer) params.set("photographer", photographer);
    return `/photos${params.toString() ? `?${params.toString()}` : ''}`;
  })();

  // Fetch a specific page of photos
  const fetchPage = useCallback(async (page: number): Promise<Photo[]> => {
    const params = new URLSearchParams();
    if (eventId) params.set("event", eventId);
    if (bandId) params.set("band", bandId);
    if (companySlug) params.set("company", companySlug);
    if (photographer) params.set("photographer", photographer);
    params.set("limit", PAGE_SIZE.toString());
    params.set("page", page.toString());
    params.set("order", "random"); // Random order for browsing strips

    const res = await fetch(`/api/photos?${params.toString()}`);
    if (!res.ok) return [];

    const data: PhotosResponse = await res.json();
    setTotalCount(data.pagination.total);
    return data.photos;
  }, [eventId, bandId, companySlug, photographer]);

  // Initial fetch
  useEffect(() => {
    async function fetchInitialPhotos() {
      setLoading(true);
      try {
        const initialPhotos = await fetchPage(1);
        setPhotos(initialPhotos);
        setLoadedPages(new Set([1]));
      } catch (error) {
        console.error("Failed to fetch photos for strip:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchInitialPhotos();
  }, [fetchPage]);

  // Load next page
  const loadNextPage = useCallback(async () => {
    const nextPage = Math.max(...Array.from(loadedPages)) + 1;
    const maxPage = Math.ceil(totalCount / PAGE_SIZE);

    if (nextPage > maxPage || loadedPages.has(nextPage) || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const newPhotos = await fetchPage(nextPage);
      if (newPhotos.length > 0) {
        setPhotos(prev => [...prev, ...newPhotos]);
        setLoadedPages(prev => new Set([...prev, nextPage]));
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [loadedPages, totalCount, isLoadingMore, fetchPage]);

  // Check if we need to prefetch based on selected index
  useEffect(() => {
    if (selectedIndex >= photos.length - PREFETCH_THRESHOLD && photos.length < totalCount) {
      loadNextPage();
    }
  }, [selectedIndex, photos.length, totalCount, loadNextPage]);

  // Auto-scroll to keep selected photo visible
  useEffect(() => {
    const photo = photoRefs.current[selectedIndex];
    if (photo && stripRef.current) {
      photo.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [selectedIndex]);

  // Handle photo click - open slideshow
  const handlePhotoClick = useCallback((index: number) => {
    if (!enableSlideshow) return;
    setSelectedIndex(index);
    setSlideshowIndex(index);
  }, [enableSlideshow]);

  // Keyboard navigation - works when strip or any of its children has focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't navigate if slideshow is open
      if (slideshowIndex !== null) return;
      
      // Only handle if the strip container or any element inside it has focus
      const activeElement = document.activeElement;
      if (!stripRef.current?.contains(activeElement)) {
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const nextIndex = Math.min(selectedIndex + 1, photos.length - 1);
        setSelectedIndex(nextIndex);
        photoRefs.current[nextIndex]?.focus();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prevIndex = Math.max(selectedIndex - 1, 0);
        setSelectedIndex(prevIndex);
        photoRefs.current[prevIndex]?.focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handlePhotoClick(selectedIndex);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photos.length, selectedIndex, slideshowIndex, handlePhotoClick]);

  // Handle slideshow close
  const handleSlideshowClose = useCallback(() => {
    setSlideshowIndex(null);
    // Re-focus the strip after closing
    photoRefs.current[selectedIndex]?.focus();
  }, [selectedIndex]);

  // Handle photo deletion from slideshow
  const handlePhotoDeleted = useCallback((photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
    setTotalCount(prev => prev - 1);
  }, []);

  // Handle photo crop from slideshow
  const handlePhotoCropped = useCallback((photoId: string, newThumbnailUrl: string) => {
    setPhotos(prev =>
      prev.map(p => p.id === photoId ? { ...p, thumbnail_url: newThumbnailUrl } : p)
    );
  }, []);

  // Don't render anything if there are no photos
  if (!loading && photos.length === 0) {
    return null;
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
                View All
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>

          {loading ? (
            // Loading skeleton
            <div className="flex gap-4 overflow-hidden px-2 py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 shrink-0 rounded-lg bg-bg animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="relative">
              {/* Left chevron button */}
              {selectedIndex > 0 && (
                <button
                  onClick={() => setSelectedIndex(prev => Math.max(prev - 1, 0))}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 md:w-12 md:h-12 rounded-full bg-bg/90 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors shadow-lg"
                  aria-label="Previous photo"
                >
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}

              {/* Right chevron button */}
              {(selectedIndex < photos.length - 1 || photos.length < totalCount) && (
                <button
                  onClick={() => setSelectedIndex(prev => Math.min(prev + 1, photos.length - 1))}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 md:w-12 md:h-12 rounded-full bg-bg/90 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors shadow-lg"
                  aria-label="Next photo"
                >
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
              
              {/* Scrollable strip with padding for ring visibility */}
              <div
                ref={stripRef}
                className="flex gap-4 overflow-x-auto px-2 py-3 -mx-2 scrollbar-thin scrollbar-track-bg scrollbar-thumb-white/20 hover:scrollbar-thumb-white/40 focus:outline-none"
                style={{ scrollbarWidth: "thin" }}
                tabIndex={0}
                role="listbox"
                aria-label="Photo gallery - use arrow keys to navigate, Enter to open"
              >
                {photos.map((photo, index) => (
                  <button
                    key={photo.id}
                    ref={(el) => { photoRefs.current[index] = el; }}
                    onClick={() => handlePhotoClick(index)}
                    onFocus={() => setSelectedIndex(index)}
                    className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 shrink-0 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 opacity-80 hover:opacity-100 focus:opacity-100 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-elevated outline-none"
                    aria-label={`Photo ${index + 1} of ${totalCount}`}
                    aria-selected={index === selectedIndex}
                    role="option"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbnail_url || photo.blob_url?.replace('/large.webp', '/thumbnail.webp')}
                      alt={photo.original_filename || `Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
                
                {/* Loading indicator at end */}
                {isLoadingMore && (
                  <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 shrink-0 rounded-lg bg-bg flex items-center justify-center">
                    <svg className="animate-spin w-8 h-8 text-text-dim" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                )}
                
                {/* More photos indicator */}
                {photos.length < totalCount && !isLoadingMore && (
                  <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 shrink-0 rounded-lg bg-bg/50 flex items-center justify-center text-text-dim">
                    <span className="text-lg font-medium">+{totalCount - photos.length} more</span>
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

      {/* Slideshow modal */}
      {slideshowIndex !== null && photos.length > 0 && (
        <PhotoSlideshow
          photos={photos}
          initialIndex={slideshowIndex}
          totalPhotos={totalCount}
          currentPage={1}
          filters={{
            eventId: eventId || null,
            bandId: bandId || null,
            companySlug: companySlug || null,
            photographer: photographer || null,
          }}
          onClose={handleSlideshowClose}
          onPhotoDeleted={handlePhotoDeleted}
          onPhotoCropped={handlePhotoCropped}
        />
      )}
    </>
  );
}

