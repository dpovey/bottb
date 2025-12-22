'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Photo, Event } from '@/lib/db'
import { PhotoGrid, type GridSize } from '@/components/photos/photo-grid'
import { PhotoSlideshow } from '@/components/photos/photo-slideshow'
import { PhotoFilters } from '@/components/photos/photo-filters'
import { PublicLayout } from '@/components/layouts'
import { trackPhotoClick, trackPhotoFilterChange } from '@/lib/analytics'
import {
  PlayCircleIcon,
  RandomIcon,
  CalendarIcon,
  BuildingIcon,
  SpinnerIcon,
} from '@/components/icons'
import type { FilterOptions } from '@/lib/nav-data'

interface Company {
  slug: string
  name: string
}

interface AvailableFilters {
  companies: { slug: string; name: string; count: number }[]
  events: { id: string; name: string; count: number }[]
  photographers: { name: string; count: number }[]
  hasPhotosWithoutCompany: boolean
}

interface PhotosResponse {
  photos: Photo[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  photographers: string[]
  companies: Company[]
  availableFilters?: AvailableFilters
}

type OrderMode = 'random' | 'date'

interface PhotosContentProps {
  initialEventId?: string | null
  initialPhotographer?: string | null
  initialCompanySlug?: string | null
  initialPhotoId?: string | null
  /** SSR-provided filter options to prevent layout shift */
  initialFilterOptions?: FilterOptions
}

export function PhotosContent({
  initialEventId = null,
  initialPhotographer = null,
  initialCompanySlug = null,
  initialPhotoId = null,
  initialFilterOptions,
}: PhotosContentProps) {
  const searchParams = useSearchParams()
  const [photos, setPhotos] = useState<Photo[]>([])
  // Initialize with SSR data if available to prevent layout shift
  const [events, setEvents] = useState<Event[]>(
    initialFilterOptions?.events.map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      location: '',
      timezone: 'UTC',
      status: 'finalized' as const,
      is_active: false,
      created_at: '',
    })) || []
  )
  const [photographers, setPhotographers] = useState<string[]>([])
  const [companies, setCompanies] = useState<Company[]>(
    initialFilterOptions?.companies || []
  )
  const [availableFilters, setAvailableFilters] = useState<
    AvailableFilters | undefined
  >()
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [orderMode, setOrderMode] = useState<OrderMode>('random')
  const [gridSize, setGridSize] = useState<GridSize>('md')
  const [showCompanyLogos, setShowCompanyLogos] = useState(true)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Page sizes: smaller initial load for faster first paint, larger for subsequent loads
  const INITIAL_PAGE_SIZE = 12
  const PAGE_SIZE = 50

  // Track loaded photo IDs to prevent duplicates in random mode
  const loadedPhotoIds = useRef<Set<string>>(new Set())

  // Track if this is the first load (for using smaller initial batch)
  const isFirstLoad = useRef(true)

  // Filters - initialize from props (resolved server-side)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    initialEventId
  )
  const [selectedPhotographer, setSelectedPhotographer] = useState<
    string | null
  >(initialPhotographer)
  const [selectedCompanySlug, setSelectedCompanySlug] = useState<string | null>(
    initialCompanySlug
  )

  // Slideshow - initialize to 0 if we have a photo ID in URL (so slideshow renders immediately)
  const [slideshowIndex, setSlideshowIndex] = useState<number | null>(
    initialPhotoId ? 0 : null
  )
  const [pendingPhotoId, setPendingPhotoId] = useState<string | null>(
    initialPhotoId
  )

  // Track current page for ordered mode
  const currentPage = useRef(1)

  // Sync filters with URL params when they change (for browser back/forward)
  useEffect(() => {
    const eventId = searchParams.get('event') || searchParams.get('eventId')
    const photographer = searchParams.get('photographer')
    const company = searchParams.get('company')
    const photoId = searchParams.get('photo')

    // Only update if URL params differ from current state (handles browser navigation)
    // Use functional updates to avoid dependency on current state values
    setSelectedEventId((prev) => {
      const urlValue = eventId || null
      return prev !== urlValue ? urlValue : prev
    })
    setSelectedPhotographer((prev) => {
      const urlValue = photographer || null
      return prev !== urlValue ? urlValue : prev
    })
    setSelectedCompanySlug((prev) => {
      const urlValue = company || null
      return prev !== urlValue ? urlValue : prev
    })
    // Only set pendingPhotoId if slideshow is not already open
    // This prevents infinite loops when the slideshow updates the URL
    if (slideshowIndex === null) {
      setPendingPhotoId((prev) => {
        const urlValue = photoId || null
        return prev !== urlValue ? urlValue : prev
      })
    }
  }, [searchParams, slideshowIndex])

  // Update URL when filters change
  const updateUrlParams = useCallback(
    (params: {
      event?: string | null
      photographer?: string | null
      company?: string | null
    }) => {
      const url = new URL(window.location.href)

      // Update each param using new cleaner names
      if (params.event !== undefined) {
        // Remove legacy param if present
        url.searchParams.delete('eventId')
        if (params.event) {
          url.searchParams.set('event', params.event)
        } else {
          url.searchParams.delete('event')
        }
      }
      if (params.photographer !== undefined) {
        if (params.photographer) {
          url.searchParams.set('photographer', params.photographer)
        } else {
          url.searchParams.delete('photographer')
        }
      }
      if (params.company !== undefined) {
        if (params.company) {
          url.searchParams.set('company', params.company)
        } else {
          url.searchParams.delete('company')
        }
      }

      // Use replaceState to avoid adding to browser history for filter changes
      window.history.replaceState({}, '', url.pathname + url.search)
    },
    []
  )

  // Wrapper functions that update both state and URL
  const handleEventChange = useCallback(
    (eventId: string | null) => {
      setSelectedEventId(eventId)
      setSlideshowIndex(slideshowIndex !== null ? 0 : null) // Reset to first photo if slideshow is open
      updateUrlParams({ event: eventId })

      // Track filter change
      trackPhotoFilterChange({
        filter_type: 'event',
        filter_value: eventId,
      })
    },
    [updateUrlParams, slideshowIndex]
  )

  const handlePhotographerChange = useCallback(
    (photographer: string | null) => {
      setSelectedPhotographer(photographer)
      setSlideshowIndex(slideshowIndex !== null ? 0 : null) // Reset to first photo if slideshow is open
      updateUrlParams({ photographer })

      // Track filter change
      trackPhotoFilterChange({
        filter_type: 'photographer',
        filter_value: photographer,
      })
    },
    [updateUrlParams, slideshowIndex]
  )

  const handleCompanyChange = useCallback(
    (company: string | null) => {
      setSelectedCompanySlug(company)
      // Clear event when company changes (optional - could keep it)
      setSelectedEventId(null)
      setSlideshowIndex(slideshowIndex !== null ? 0 : null) // Reset to first photo if slideshow is open
      updateUrlParams({ company, event: null })

      // Track filter change
      trackPhotoFilterChange({
        filter_type: 'company',
        filter_value: company,
      })
    },
    [updateUrlParams, slideshowIndex]
  )

  // Track if we're fetching the specific photo for the URL
  const fetchingPendingPhoto = useRef(false)

  // Open slideshow when photos load and we have a pending photo ID
  useEffect(() => {
    if (pendingPhotoId && photos.length > 0 && !loading) {
      const index = photos.findIndex((p) => p.id === pendingPhotoId)
      if (index !== -1) {
        setSlideshowIndex(index)
        setPendingPhotoId(null)
        fetchingPendingPhoto.current = false
      } else if (!fetchingPendingPhoto.current) {
        // Photo not found in current batch - fetch it specifically
        fetchingPendingPhoto.current = true

        fetch(`/api/photos/${pendingPhotoId}`)
          .then((res) => {
            if (!res.ok) throw new Error('Photo not found')
            return res.json()
          })
          .then((photo: Photo) => {
            // Prepend the photo to the array so it shows at index 0
            setPhotos((prev) => {
              // Avoid duplicates
              if (prev.some((p) => p.id === photo.id)) return prev
              return [photo, ...prev]
            })
            loadedPhotoIds.current.add(photo.id)
            // Open slideshow at index 0 (where we prepended the photo)
            setSlideshowIndex(0)
            setPendingPhotoId(null)
            fetchingPendingPhoto.current = false
          })
          .catch((error) => {
            console.error('Failed to fetch photo for URL:', error)
            setPendingPhotoId(null)
            fetchingPendingPhoto.current = false
          })
      }
    }
  }, [pendingPhotoId, photos, loading])

  // Fetch events on mount (only if not provided via SSR)
  useEffect(() => {
    // Skip if we already have SSR data
    if (initialFilterOptions) return

    async function fetchFilters() {
      try {
        // Fetch both past and upcoming events (public endpoints)
        const [pastRes, upcomingRes] = await Promise.all([
          fetch('/api/events/past'),
          fetch('/api/events/upcoming'),
        ])

        const allEvents: Event[] = []
        if (pastRes.ok) {
          const pastData = await pastRes.json()
          allEvents.push(...(Array.isArray(pastData) ? pastData : []))
        }
        if (upcomingRes.ok) {
          const upcomingData = await upcomingRes.json()
          allEvents.push(...(Array.isArray(upcomingData) ? upcomingData : []))
        }
        // Sort by date descending
        allEvents.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        setEvents(allEvents)
      } catch (error) {
        console.error('Failed to fetch events:', error)
      }
    }

    fetchFilters()
  }, [initialFilterOptions])

  // Reset photos when filters or order mode change
  useEffect(() => {
    setPhotos([])
    loadedPhotoIds.current = new Set()
    currentPage.current = 1
    isFirstLoad.current = true
    setLoading(true)
  }, [selectedEventId, selectedPhotographer, selectedCompanySlug, orderMode])

  // Fetch photos - initial load or load more
  const fetchPhotos = useCallback(
    async (isLoadMore = false) => {
      if (isLoadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }

      try {
        const params = new URLSearchParams()
        if (selectedEventId) params.set('event', selectedEventId)
        if (selectedPhotographer)
          params.set('photographer', selectedPhotographer)
        if (selectedCompanySlug) params.set('company', selectedCompanySlug)

        // Use smaller batch for initial load (faster first paint), larger for subsequent loads
        const limit = isLoadMore
          ? PAGE_SIZE
          : isFirstLoad.current
            ? INITIAL_PAGE_SIZE
            : PAGE_SIZE
        params.set('limit', limit.toString())
        params.set('order', orderMode)

        // For ordered mode, use pagination; for random, always fetch fresh
        if (orderMode === 'date') {
          params.set('page', currentPage.current.toString())
        }

        // Skip filter metadata on "load more" requests (reduces API queries from 11 to 1)
        if (isLoadMore) {
          params.set('skipMeta', 'true')
        }

        const res = await fetch(`/api/photos?${params.toString()}`)
        if (res.ok) {
          const data: PhotosResponse = await res.json()
          setTotalCount(data.pagination.total)

          // Only update filter metadata if returned (not skipped on load-more)
          if (data.photographers && data.photographers.length > 0) {
            setPhotographers(data.photographers)
          }
          if (data.companies && data.companies.length > 0) {
            setCompanies(data.companies)
          }
          if (data.availableFilters) {
            setAvailableFilters(data.availableFilters)
          }

          if (isLoadMore) {
            // Filter out duplicates (important for random mode)
            const newPhotos = data.photos.filter(
              (p) => !loadedPhotoIds.current.has(p.id)
            )
            newPhotos.forEach((p) => loadedPhotoIds.current.add(p.id))
            setPhotos((prev) => [...prev, ...newPhotos])
            if (orderMode === 'date') {
              currentPage.current += 1
            }
          } else {
            // Initial load
            loadedPhotoIds.current = new Set(data.photos.map((p) => p.id))
            setPhotos(data.photos)
            currentPage.current = 2 // Next load will be page 2
            isFirstLoad.current = false // Subsequent loads will use larger batch
          }
        }
      } catch (error) {
        console.error('Failed to fetch photos:', error)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [selectedEventId, selectedPhotographer, selectedCompanySlug, orderMode]
  )

  // Initial fetch when filters change
  useEffect(() => {
    fetchPhotos(false)
  }, [fetchPhotos])

  // Infinite scroll - load more when reaching bottom
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (
          entry.isIntersecting &&
          !loading &&
          !loadingMore &&
          photos.length < totalCount
        ) {
          fetchPhotos(true)
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [loading, loadingMore, photos.length, totalCount, fetchPhotos])

  // Handle photo click
  const handlePhotoClick = (index: number) => {
    setSlideshowIndex(index)

    // Track photo click
    const photo = photos[index]
    if (photo) {
      trackPhotoClick({
        photo_id: photo.id,
        event_id: photo.event_id || null,
        band_id: photo.band_id || null,
        event_name: photo.event_name || null,
        band_name: photo.band_name || null,
      })
    }
  }

  // Handle slideshow close
  const handleSlideshowClose = () => {
    setSlideshowIndex(null)
    // Clear the photo param from URL
    const url = new URL(window.location.href)
    url.searchParams.delete('photo')
    window.history.replaceState({}, '', url.pathname + url.search)
  }

  // Handle photo change in slideshow (update URL)
  const handlePhotoChange = (photoId: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('photo', photoId)
    window.history.replaceState({}, '', url.pathname + url.search)
  }

  // Handle photo deletion (called from slideshow)
  const handlePhotoDeleted = (photoId: string) => {
    // Remove the photo from local state
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    loadedPhotoIds.current.delete(photoId)
    // Update total count
    setTotalCount((prev) => prev - 1)
  }

  // Handle photo crop (called from slideshow)
  const handlePhotoCropped = (photoId: string, newThumbnailUrl: string) => {
    // Update the thumbnail URL in local state
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photoId ? { ...p, thumbnail_url: newThumbnailUrl } : p
      )
    )
  }

  return (
    <PublicLayout
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Photos' }]}
      footerVariant="simple"
    >
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="font-semibold text-4xl mb-2">Photo Gallery</h1>
              <p className="text-text-muted">
                {photos.length} of {totalCount} photo
                {totalCount !== 1 ? 's' : ''} from {events.length} event
                {events.length !== 1 ? 's' : ''}
              </p>
            </div>
            {photos.length > 0 && (
              <button
                onClick={() => setSlideshowIndex(0)}
                className="border border-accent/40 text-accent hover:bg-accent/10 px-6 py-3 rounded-full text-xs tracking-widest uppercase font-medium flex items-center gap-2 self-start sm:self-auto transition-colors"
              >
                <PlayCircleIcon size={16} />
                Slideshow
              </button>
            )}
          </div>

          {/* View controls - Order & Size */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Order toggle */}
            <div className="flex items-center bg-bg-elevated rounded-full p-1">
              <button
                onClick={() => setOrderMode('random')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  orderMode === 'random'
                    ? 'bg-accent text-white'
                    : 'text-text-muted hover:text-white'
                }`}
                title="Show photos in random order"
              >
                <RandomIcon size={14} />
                <span className="hidden sm:inline">Random</span>
              </button>
              <button
                onClick={() => setOrderMode('date')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  orderMode === 'date'
                    ? 'bg-accent text-white'
                    : 'text-text-muted hover:text-white'
                }`}
                title="Show photos by date"
              >
                <CalendarIcon size={14} strokeWidth={2} />
                <span className="hidden sm:inline">By Date</span>
              </button>
            </div>

            {/* Size selector */}
            <div className="flex items-center bg-bg-elevated rounded-full p-1">
              <button
                onClick={() => setGridSize('xs')}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  gridSize === 'xs'
                    ? 'bg-accent text-white'
                    : 'text-text-muted hover:text-white'
                }`}
                title="Extra large thumbnails (1 per row on mobile)"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <rect x="2" y="2" width="12" height="12" rx="1" />
                </svg>
              </button>
              <button
                onClick={() => setGridSize('sm')}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  gridSize === 'sm'
                    ? 'bg-accent text-white'
                    : 'text-text-muted hover:text-white'
                }`}
                title="Large thumbnails"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <rect x="1" y="1" width="6" height="6" rx="1" />
                  <rect x="9" y="1" width="6" height="6" rx="1" />
                  <rect x="1" y="9" width="6" height="6" rx="1" />
                  <rect x="9" y="9" width="6" height="6" rx="1" />
                </svg>
              </button>
              <button
                onClick={() => setGridSize('md')}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  gridSize === 'md'
                    ? 'bg-accent text-white'
                    : 'text-text-muted hover:text-white'
                }`}
                title="Medium thumbnails (default)"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <rect x="1" y="1" width="4" height="4" rx="0.5" />
                  <rect x="6" y="1" width="4" height="4" rx="0.5" />
                  <rect x="11" y="1" width="4" height="4" rx="0.5" />
                  <rect x="1" y="6" width="4" height="4" rx="0.5" />
                  <rect x="6" y="6" width="4" height="4" rx="0.5" />
                  <rect x="11" y="6" width="4" height="4" rx="0.5" />
                  <rect x="1" y="11" width="4" height="4" rx="0.5" />
                  <rect x="6" y="11" width="4" height="4" rx="0.5" />
                  <rect x="11" y="11" width="4" height="4" rx="0.5" />
                </svg>
              </button>
              <button
                onClick={() => setGridSize('lg')}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  gridSize === 'lg'
                    ? 'bg-accent text-white'
                    : 'text-text-muted hover:text-white'
                }`}
                title="Small thumbnails (compact)"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <rect x="1" y="1" width="3" height="3" rx="0.3" />
                  <rect x="5" y="1" width="3" height="3" rx="0.3" />
                  <rect x="9" y="1" width="3" height="3" rx="0.3" />
                  <rect x="13" y="1" width="2" height="3" rx="0.3" />
                  <rect x="1" y="5" width="3" height="3" rx="0.3" />
                  <rect x="5" y="5" width="3" height="3" rx="0.3" />
                  <rect x="9" y="5" width="3" height="3" rx="0.3" />
                  <rect x="13" y="5" width="2" height="3" rx="0.3" />
                  <rect x="1" y="9" width="3" height="3" rx="0.3" />
                  <rect x="5" y="9" width="3" height="3" rx="0.3" />
                  <rect x="9" y="9" width="3" height="3" rx="0.3" />
                  <rect x="13" y="9" width="2" height="3" rx="0.3" />
                  <rect x="1" y="13" width="3" height="2" rx="0.3" />
                  <rect x="5" y="13" width="3" height="2" rx="0.3" />
                  <rect x="9" y="13" width="3" height="2" rx="0.3" />
                  <rect x="13" y="13" width="2" height="2" rx="0.3" />
                </svg>
              </button>
            </div>

            {/* Company logos toggle */}
            <div className="flex items-center bg-bg-elevated rounded-full h-10 px-3">
              <label
                className="flex items-center gap-2 cursor-pointer"
                title={
                  showCompanyLogos ? 'Hide company logos' : 'Show company logos'
                }
              >
                <BuildingIcon size={16} className="text-text-muted" />
                <button
                  role="switch"
                  aria-checked={showCompanyLogos}
                  onClick={() => setShowCompanyLogos(!showCompanyLogos)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    showCompanyLogos ? 'bg-accent' : 'bg-bg-surface'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      showCompanyLogos ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>
            </div>
          </div>
        </div>

        {/* Filters */}
        <PhotoFilters
          events={events}
          photographers={photographers}
          companies={companies}
          availableFilters={availableFilters}
          selectedEventId={selectedEventId}
          selectedPhotographer={selectedPhotographer}
          selectedCompanySlug={selectedCompanySlug}
          onEventChange={handleEventChange}
          onPhotographerChange={handlePhotographerChange}
          onCompanyChange={handleCompanyChange}
          loading={loading}
        />

        {/* Photo grid */}
        <div className="mt-8">
          <PhotoGrid
            photos={photos}
            onPhotoClick={handlePhotoClick}
            loading={loading}
            size={gridSize}
            showCompanyLogos={showCompanyLogos}
          />
        </div>

        {/* Infinite scroll trigger */}
        <div
          ref={loadMoreRef}
          className="mt-12 h-20 flex items-center justify-center"
        >
          {loadingMore && (
            <div className="flex items-center gap-3 text-text-muted">
              <SpinnerIcon size={20} className="animate-spin" />
              <span className="text-sm">Loading more photos...</span>
            </div>
          )}
          {!loadingMore && photos.length >= totalCount && photos.length > 0 && (
            <p className="text-text-dim text-sm">
              All {totalCount} photos loaded
            </p>
          )}
        </div>
      </main>

      {/* Slideshow modal */}
      {slideshowIndex !== null && (photos.length > 0 || pendingPhotoId) && (
        <PhotoSlideshow
          photos={photos}
          initialIndex={slideshowIndex}
          totalPhotos={totalCount}
          currentPage={1}
          filters={{
            eventId: selectedEventId,
            photographer: selectedPhotographer,
            companySlug: selectedCompanySlug,
          }}
          filterNames={{
            eventName: events.find((e) => e.id === selectedEventId)?.name,
            photographer: selectedPhotographer,
            companyName:
              selectedCompanySlug === 'none'
                ? 'No Company'
                : companies.find((c) => c.slug === selectedCompanySlug)?.name,
          }}
          onFilterChange={(filterType, value) => {
            switch (filterType) {
              case 'event':
                handleEventChange(value)
                break
              case 'photographer':
                handlePhotographerChange(value)
                break
              case 'company':
                handleCompanyChange(value)
                break
            }
          }}
          onClose={handleSlideshowClose}
          onPhotoDeleted={handlePhotoDeleted}
          onPhotoCropped={handlePhotoCropped}
          onPhotoChange={handlePhotoChange}
        />
      )}
    </PublicLayout>
  )
}
