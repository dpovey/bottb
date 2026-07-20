'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Event, PhotoWithCluster } from '@/lib/db'
import { PhotoSlideshow } from '@/components/photos/photo-slideshow'
import { photoFiltersToApiParams } from '@/lib/photo-filters'
import { usePhotoFilters } from '@/lib/use-photo-filters'
import { VinylSpinner } from '@/components/ui'

interface Company {
  slug: string
  name: string
}

interface PhotosResponse {
  photos: PhotoWithCluster[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  photographers: string[]
  companies: Company[]
  seed?: string
}

interface SlideshowPageContentProps {
  initialPhotoId: string
  initialEventId: string | null
  initialPhotographer: string | null
  initialCompanySlug: string | null
  /** Shuffle param from URL: 'true', specific seed, or null for date order */
  initialShuffle: string | null
}

export function SlideshowPageContent({
  initialPhotoId,
  initialEventId,
  initialPhotographer,
  initialCompanySlug,
  initialShuffle,
}: SlideshowPageContentProps) {
  const router = useRouter()

  const [photos, setPhotos] = useState<PhotoWithCluster[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [slideshowIndex, setSlideshowIndex] = useState(0)
  // Initial cluster index map for deep links to non-representative photos
  const [initialClusterIndexes, setInitialClusterIndexes] = useState<
    Map<string, number>
  >(new Map())

  // Shared filter state. Filter changes are committed to the URL through the
  // Next router (keeping useSearchParams authoritative), so closing the
  // slideshow and returning to the gallery preserves the active filters.
  // No localStorage here - the slideshow follows the URL it was opened with.
  const { filters, setFilters } = usePhotoFilters({
    initial: {
      eventId: initialEventId,
      photographer: initialPhotographer,
      companySlug: initialCompanySlug,
      shuffle: initialShuffle,
      groupDuplicates: true,
      groupScenes: true,
    },
    basePath: `/slideshow/${initialPhotoId}`,
  })

  const {
    eventId: selectedEventId,
    photographer: selectedPhotographer,
    companySlug: selectedCompanySlug,
    shuffle,
  } = filters

  // Track if initial photo has been loaded
  const initialPhotoLoaded = useRef(false)

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
  async function fetchPhotos() {
    setLoading(true)

    try {
      // Single source of truth for filter → API params (shared with the
      // gallery). groupTypes defaults to 'near_duplicate,scene', order to 'date'.
      const params = photoFiltersToApiParams(filters, { limit: 50 })

      const res = await fetch(`/api/photos?${params.toString()}`)
      if (res.ok) {
        const data: PhotosResponse = await res.json()
        setTotalCount(data.pagination.total)
        if (data.companies) setCompanies(data.companies)

        // Resolve seed from API response if we sent 'true'. Keep it out of the
        // URL (commitUrl: false) - it just pins the order we're already showing.
        if (data.seed && shuffle === 'true') {
          setFilters({ shuffle: data.seed }, { commitUrl: false })
        }

        // Find the initial photo in the results
        // It could be a representative photo OR inside a cluster
        let photosToSet = data.photos
        let foundIndex = -1
        let foundClusterIndex = -1
        let foundRepPhotoId: string | null = null

        // First, check if it's a representative photo (top level)
        foundIndex = data.photos.findIndex((p) => p.id === initialPhotoId)

        // If not found at top level, search within clusters
        if (foundIndex === -1) {
          for (let i = 0; i < data.photos.length; i++) {
            const repPhoto = data.photos[i]
            if (repPhoto.cluster_photos && repPhoto.cluster_photos.length > 1) {
              const clusterIdx = repPhoto.cluster_photos.findIndex(
                (cp) => cp.id === initialPhotoId
              )
              if (clusterIdx !== -1) {
                foundIndex = i
                foundClusterIndex = clusterIdx
                foundRepPhotoId = repPhoto.id
                break
              }
            }
          }
        }

        if (foundIndex !== -1) {
          // Photo found (either as representative or within a cluster)
          setSlideshowIndex(foundIndex)

          // If found within a cluster, set the initial cluster index
          if (foundClusterIndex !== -1 && foundRepPhotoId) {
            const newClusterIndexes = new Map<string, number>()
            newClusterIndexes.set(foundRepPhotoId, foundClusterIndex)
            setInitialClusterIndexes(newClusterIndexes)
          }

          initialPhotoLoaded.current = true
        } else if (!initialPhotoLoaded.current) {
          // Photo not in current batch - fetch it directly and prepend
          // This happens when the photo doesn't match current filters
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
  }

  // Fetch photos on mount and when filters change
  useEffect(() => {
    fetchPhotos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedEventId,
    selectedPhotographer,
    selectedCompanySlug,
    initialPhotoId,
    shuffle,
  ])

  // Handle close - use browser back
  function handleClose() {
    router.back()
  }

  // Handle photo change - update the URL path to the new photo ID without a
  // navigation. Preserve the existing Next router history state (never pass an
  // empty object) so browser back/forward restoration keeps working.
  function handlePhotoChange(photoId: string) {
    const newPath = `/slideshow/${photoId}${window.location.search}`
    window.history.replaceState(window.history.state, '', newPath)
  }

  // Handle photo deleted
  function handlePhotoDeleted(photoId: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    setTotalCount((prev) => prev - 1)
  }

  // Handle filter change from slideshow. Commit the change to the current
  // slideshow URL (keeping the photo id in the path) via the shared hook, which
  // routes through the Next router so the gallery sees it on close/back.
  function handleFilterChange(filterType: string, value: string | null) {
    const path = window.location.pathname

    switch (filterType) {
      case 'event':
        setFilters({ eventId: value }, { path })
        break
      case 'photographer':
        setFilters({ photographer: value }, { path })
        break
      case 'company':
        // Clear event when company changes
        setFilters({ companySlug: value, eventId: null }, { path })
        break
      case 'shuffle':
        setFilters({ shuffle: value }, { path })
        break
    }

    // Reset to first photo when filters change
    setSlideshowIndex(0)
    initialPhotoLoaded.current = false
  }

  // Loading state
  if (loading && photos.length === 0) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-white text-center">
          <VinylSpinner size="md" className="mx-auto mb-4" />
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
        shuffle: shuffle || undefined,
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
      onPhotoChange={handlePhotoChange}
      mode="page"
      initialClusterIndexes={
        initialClusterIndexes.size > 0 ? initialClusterIndexes : undefined
      }
    />
  )
}
