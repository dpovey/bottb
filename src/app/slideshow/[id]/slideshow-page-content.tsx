'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Photo, Event } from '@/lib/db'
import { PhotoSlideshow } from '@/components/photos/photo-slideshow'

interface Company {
  slug: string
  name: string
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
}

interface SlideshowPageContentProps {
  initialPhotoId: string
  initialEventId: string | null
  initialPhotographer: string | null
  initialCompanySlug: string | null
  initialSeed: number | null
}

export function SlideshowPageContent({
  initialPhotoId,
  initialEventId,
  initialPhotographer,
  initialCompanySlug,
  initialSeed,
}: SlideshowPageContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [photos, setPhotos] = useState<Photo[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [slideshowIndex, setSlideshowIndex] = useState(0)

  // Seed for deterministic random ordering (from gallery URL)
  const seed = initialSeed

  // Filters from URL
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    initialEventId
  )
  const [selectedPhotographer, setSelectedPhotographer] = useState<
    string | null
  >(initialPhotographer)
  const [selectedCompanySlug, setSelectedCompanySlug] = useState<string | null>(
    initialCompanySlug
  )

  // Track if initial photo has been loaded
  const initialPhotoLoaded = useRef(false)

  // Sync filters with URL params when they change (browser back/forward)
  useEffect(() => {
    const eventId = searchParams.get('event')
    const photographer = searchParams.get('photographer')
    const company = searchParams.get('company')

    setSelectedEventId(eventId || null)
    setSelectedPhotographer(photographer || null)
    setSelectedCompanySlug(company || null)
  }, [searchParams])

  // Fetch events on mount
  useEffect(() => {
    async function fetchFilters() {
      try {
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
        allEvents.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        setEvents(allEvents)
      } catch (error) {
        console.error('Failed to fetch events:', error)
      }
    }

    fetchFilters()
  }, [])

  // Fetch photos based on filters
  const fetchPhotos = useCallback(async () => {
    setLoading(true)

    try {
      const params = new URLSearchParams()
      if (selectedEventId) params.set('event', selectedEventId)
      if (selectedPhotographer) params.set('photographer', selectedPhotographer)
      if (selectedCompanySlug) params.set('company', selectedCompanySlug)
      params.set('limit', '50')
      // Use same random order as gallery if seed is provided, otherwise date order
      if (seed) {
        params.set('order', 'random')
        params.set('seed', seed.toString())
      } else {
        params.set('order', 'date')
      }

      const res = await fetch(`/api/photos?${params.toString()}`)
      if (res.ok) {
        const data: PhotosResponse = await res.json()
        setTotalCount(data.pagination.total)
        if (data.companies) setCompanies(data.companies)

        // Find the initial photo in the results or fetch it
        let photosToSet = data.photos
        const initialIndex = data.photos.findIndex(
          (p) => p.id === initialPhotoId
        )

        if (initialIndex !== -1) {
          // Photo found in filtered results
          setSlideshowIndex(initialIndex)
          initialPhotoLoaded.current = true
        } else if (!initialPhotoLoaded.current) {
          // Photo not in current batch - fetch it directly and prepend
          try {
            const photoRes = await fetch(`/api/photos/${initialPhotoId}`)
            if (photoRes.ok) {
              const photo = await photoRes.json()
              photosToSet = [
                photo,
                ...data.photos.filter((p) => p.id !== photo.id),
              ]
              setSlideshowIndex(0)
              initialPhotoLoaded.current = true
            }
          } catch {
            // If we can't fetch the specific photo, just use what we have
            setSlideshowIndex(0)
          }
        }

        setPhotos(photosToSet)
      }
    } catch (error) {
      console.error('Failed to fetch photos:', error)
    } finally {
      setLoading(false)
    }
  }, [
    selectedEventId,
    selectedPhotographer,
    selectedCompanySlug,
    initialPhotoId,
    seed,
  ])

  // Fetch photos on mount and when filters change
  useEffect(() => {
    fetchPhotos()
  }, [fetchPhotos])

  // Handle close - use browser back
  const handleClose = useCallback(() => {
    router.back()
  }, [router])

  // Handle photo change - update URL
  const handlePhotoChange = useCallback((photoId: string) => {
    const url = new URL(window.location.href)
    // Update the path to the new photo ID
    const newPath = `/slideshow/${photoId}${url.search}`
    window.history.replaceState({}, '', newPath)
  }, [])

  // Handle photo deleted
  const handlePhotoDeleted = useCallback((photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    setTotalCount((prev) => prev - 1)
  }, [])

  // Handle photo cropped
  const handlePhotoCropped = useCallback(
    (photoId: string, newThumbnailUrl: string) => {
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId ? { ...p, thumbnail_url: newThumbnailUrl } : p
        )
      )
    },
    []
  )

  // Handle filter change from slideshow
  const handleFilterChange = useCallback(
    (filterType: string, value: string | null) => {
      const url = new URL(window.location.href)

      switch (filterType) {
        case 'event':
          setSelectedEventId(value)
          if (value) {
            url.searchParams.set('event', value)
          } else {
            url.searchParams.delete('event')
          }
          break
        case 'photographer':
          setSelectedPhotographer(value)
          if (value) {
            url.searchParams.set('photographer', value)
          } else {
            url.searchParams.delete('photographer')
          }
          break
        case 'company':
          setSelectedCompanySlug(value)
          setSelectedEventId(null) // Clear event when company changes
          url.searchParams.delete('event')
          if (value) {
            url.searchParams.set('company', value)
          } else {
            url.searchParams.delete('company')
          }
          break
      }

      window.history.replaceState({}, '', url.pathname + url.search)
      // Reset to first photo when filters change
      setSlideshowIndex(0)
      initialPhotoLoaded.current = false
    },
    []
  )

  // Loading state
  if (loading && photos.length === 0) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Loading photos...</p>
        </div>
      </div>
    )
  }

  return (
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
      onFilterChange={handleFilterChange}
      onClose={handleClose}
      onPhotoDeleted={handlePhotoDeleted}
      onPhotoCropped={handlePhotoCropped}
      onPhotoChange={handlePhotoChange}
      mode="page"
    />
  )
}
