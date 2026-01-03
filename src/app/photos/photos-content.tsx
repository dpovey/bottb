'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Event, PhotoWithCluster } from '@/lib/db'
import {
  PhotoGrid,
  type GridSize,
  type ClusterMap,
} from '@/components/photos/photo-grid'
import { PhotoFilters } from '@/components/photos/photo-filters'
import { PublicLayout } from '@/components/layouts'
import { trackPhotoClick, trackPhotoFilterChange } from '@/lib/analytics'
import { PlayCircleIcon, BuildingIcon, ScenesIcon } from '@/components/icons'
import { VinylSpinner } from '@/components/ui'
import { ShuffleButton } from '@/components/photos/shuffle-button'
import { GroupingButton } from '@/components/photos/grouping-button'
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
  photos: PhotoWithCluster[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  photographers: string[]
  companies: Company[]
  availableFilters?: AvailableFilters
  seed?: string // The shuffle seed used by the server
}

interface PhotosContentProps {
  initialEventId?: string | null
  initialPhotographer?: string | null
  initialCompanySlug?: string | null
  /** SSR-provided filter options to prevent layout shift */
  initialFilterOptions?: FilterOptions
  /** SSR-provided total photo count for immediate slideshow button display */
  initialTotalPhotos?: number
}

// localStorage key for persisting filter preferences
const FILTERS_STORAGE_KEY = 'photos-filters'

interface StoredFilters {
  event?: string | null
  photographer?: string | null
  company?: string | null
  shuffle?: string | null
  groupDuplicates?: boolean
  groupScenes?: boolean
}

export function PhotosContent({
  initialEventId = null,
  initialPhotographer = null,
  initialCompanySlug = null,
  initialFilterOptions,
  initialTotalPhotos = 0,
}: PhotosContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [photos, setPhotos] = useState<PhotoWithCluster[]>([])
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
  // Shuffle state: null = off (date order), 'true' = shared shuffle, '<seed>' = specific seed
  // Default to null (date order) for SEO - consistent content for crawlers
  const [shuffle, setShuffle] = useState<string | null>(
    searchParams.get('shuffle') ?? null
  )
  const [gridSize, setGridSize] = useState<GridSize>('md')
  const [showCompanyLogos, setShowCompanyLogos] = useState(true)
  // Grouping states: collapse near-duplicate and/or scene photos
  // Both default to true (grouping enabled)
  const [groupDuplicates, setGroupDuplicates] = useState<boolean>(
    searchParams.get('groupDuplicates') !== 'false'
  )
  const [groupScenes, setGroupScenes] = useState<boolean>(
    searchParams.get('groupScenes') !== 'false'
  )
  // Map of representative photo ID to cluster data (photos + current display index)
  const [clusterMap, setClusterMap] = useState<ClusterMap>(new Map())
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Page sizes
  const PAGE_SIZE = 50

  // Track loaded photo IDs to prevent duplicates in random mode
  const loadedPhotoIds = useRef<Set<string>>(new Set())

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

  // Track current page for ordered mode
  const currentPage = useRef(1)

  // Check if URL has any filter params (means user navigated with specific filters)
  // This is computed once on mount and cached
  const hasUrlFiltersRef = useRef(
    searchParams.has('event') ||
      searchParams.has('eventId') ||
      searchParams.has('photographer') ||
      searchParams.has('company') ||
      searchParams.has('shuffle') ||
      searchParams.has('groupDuplicates') ||
      searchParams.has('groupScenes')
  )

  // Track if filters have been initialized (localStorage checked or URL params applied)
  // Starts as true if URL has params (no need to wait), false otherwise
  const [filtersInitialized, setFiltersInitialized] = useState(
    hasUrlFiltersRef.current
  )

  // Restore filters from localStorage on mount (only if no URL filters)
  // This effect runs exactly once on mount
  useEffect(() => {
    // If URL has filters, we're already initialized (URL takes precedence)
    if (hasUrlFiltersRef.current) return

    // No URL filters - restore from localStorage
    try {
      const stored = localStorage.getItem(FILTERS_STORAGE_KEY)
      if (stored) {
        const filters: StoredFilters = JSON.parse(stored)
        if (filters.event) setSelectedEventId(filters.event)
        if (filters.photographer) setSelectedPhotographer(filters.photographer)
        if (filters.company) setSelectedCompanySlug(filters.company)
        if (filters.shuffle !== undefined) {
          setShuffle(filters.shuffle)
        }
        if (filters.groupDuplicates !== undefined) {
          setGroupDuplicates(filters.groupDuplicates)
        }
        if (filters.groupScenes !== undefined) {
          setGroupScenes(filters.groupScenes)
        }
      }
    } catch {
      // Ignore localStorage errors
    }

    // Mark as initialized after restoration
    setFiltersInitialized(true)
  }, []) // Empty deps - run once on mount

  // Save filters to localStorage when they change
  useEffect(() => {
    // Only save after filters are initialized (prevents saving default values)
    if (!filtersInitialized) return

    const filters: StoredFilters = {
      event: selectedEventId,
      photographer: selectedPhotographer,
      company: selectedCompanySlug,
      shuffle,
      groupDuplicates,
      groupScenes,
    }
    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters))
    } catch {
      // Ignore localStorage errors
    }
  }, [
    selectedEventId,
    selectedPhotographer,
    selectedCompanySlug,
    shuffle,
    groupDuplicates,
    groupScenes,
    filtersInitialized,
  ])

  // Sync filters with URL params when they change (for browser back/forward)
  // Only update each filter if URL explicitly has that param - this preserves
  // localStorage-restored values when navigating to /photos without params
  useEffect(() => {
    // Only update event if URL explicitly has an event param
    if (searchParams.has('event') || searchParams.has('eventId')) {
      const eventId = searchParams.get('event') || searchParams.get('eventId')
      setSelectedEventId((prev) => {
        const urlValue = eventId || null
        return prev !== urlValue ? urlValue : prev
      })
    }

    // Only update photographer if URL explicitly has the param
    if (searchParams.has('photographer')) {
      const photographer = searchParams.get('photographer')
      setSelectedPhotographer((prev) => {
        const urlValue = photographer || null
        return prev !== urlValue ? urlValue : prev
      })
    }

    // Only update company if URL explicitly has the param
    if (searchParams.has('company')) {
      const company = searchParams.get('company')
      setSelectedCompanySlug((prev) => {
        const urlValue = company || null
        return prev !== urlValue ? urlValue : prev
      })
    }

    // Only update shuffle if URL explicitly has a shuffle param
    // This preserves the default 'true' when navigating without shuffle param
    if (searchParams.has('shuffle')) {
      const shuffleParam = searchParams.get('shuffle')
      setShuffle((prev) => {
        const urlValue = shuffleParam || null
        return prev !== urlValue ? urlValue : prev
      })
    }

    // Only update grouping if URL explicitly has the params
    if (searchParams.has('groupDuplicates')) {
      const param = searchParams.get('groupDuplicates')
      setGroupDuplicates(param !== 'false')
    }
    if (searchParams.has('groupScenes')) {
      const param = searchParams.get('groupScenes')
      setGroupScenes(param !== 'false')
    }
  }, [searchParams])

  // Update URL when filters change
  const updateUrlParams = useCallback(
    (params: {
      event?: string | null
      photographer?: string | null
      company?: string | null
      shuffle?: string | null
      groupDuplicates?: boolean
      groupScenes?: boolean
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
      if (params.shuffle !== undefined) {
        if (params.shuffle) {
          url.searchParams.set('shuffle', params.shuffle)
        } else {
          url.searchParams.delete('shuffle')
        }
      }
      // Grouping: only add to URL when disabled (default is ON)
      if (params.groupDuplicates !== undefined) {
        if (!params.groupDuplicates) {
          url.searchParams.set('groupDuplicates', 'false')
        } else {
          url.searchParams.delete('groupDuplicates')
        }
      }
      if (params.groupScenes !== undefined) {
        if (!params.groupScenes) {
          url.searchParams.set('groupScenes', 'false')
        } else {
          url.searchParams.delete('groupScenes')
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
      updateUrlParams({ event: eventId })

      // Track filter change
      trackPhotoFilterChange({
        filter_type: 'event',
        filter_value: eventId,
      })
    },
    [updateUrlParams]
  )

  const handlePhotographerChange = useCallback(
    (photographer: string | null) => {
      setSelectedPhotographer(photographer)
      updateUrlParams({ photographer })

      // Track filter change
      trackPhotoFilterChange({
        filter_type: 'photographer',
        filter_value: photographer,
      })
    },
    [updateUrlParams]
  )

  const handleCompanyChange = useCallback(
    (company: string | null) => {
      setSelectedCompanySlug(company)
      // Clear event when company changes (optional - could keep it)
      setSelectedEventId(null)
      updateUrlParams({ company, event: null })

      // Track filter change
      trackPhotoFilterChange({
        filter_type: 'company',
        filter_value: company,
      })
    },
    [updateUrlParams]
  )

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

  // Reset photos when filters, shuffle, or grouping changes
  useEffect(() => {
    setPhotos([])
    loadedPhotoIds.current = new Set()
    currentPage.current = 1
    setLoading(true)
  }, [
    selectedEventId,
    selectedPhotographer,
    selectedCompanySlug,
    shuffle,
    groupDuplicates,
    groupScenes,
  ])

  // Build cluster map from embedded cluster_photos data
  useEffect(() => {
    const anyGroupingEnabled = groupDuplicates || groupScenes
    if (!anyGroupingEnabled || !photos?.length) {
      setClusterMap(new Map())
      return
    }

    // Build cluster map from embedded cluster_photos
    const newClusterMap: ClusterMap = new Map()
    for (const photo of photos) {
      if (photo.cluster_photos && photo.cluster_photos.length > 1) {
        newClusterMap.set(photo.id, {
          photos: photo.cluster_photos,
          currentIndex: 0,
        })
      }
    }

    setClusterMap(newClusterMap)
  }, [photos, groupDuplicates, groupScenes])

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

        params.set('limit', PAGE_SIZE.toString())

        // Set shuffle or order by date
        if (shuffle) {
          params.set('shuffle', shuffle)
        } else {
          params.set('order', 'date')
        }

        // Build groupTypes parameter based on enabled toggles
        const groupTypes: string[] = []
        if (groupDuplicates) groupTypes.push('near_duplicate')
        if (groupScenes) groupTypes.push('scene')
        if (groupTypes.length > 0) {
          params.set('groupTypes', groupTypes.join(','))
        }

        // Always use pagination - shuffle mode is deterministic (same seed = same order)
        params.set('page', currentPage.current.toString())

        // Skip filter metadata on "load more" requests (reduces API queries from 11 to 1)
        if (isLoadMore) {
          params.set('skipMeta', 'true')
        }

        const res = await fetch(`/api/photos?${params.toString()}`)
        if (res.ok) {
          const data: PhotosResponse = await res.json()
          setTotalCount(data.pagination.total)

          // Capture the actual seed from the API response
          // This is important: when we send shuffle=true, the API generates a seed
          // We need to use this seed for slideshow navigation
          if (data.seed && shuffle && shuffle !== data.seed) {
            setShuffle(data.seed)
          }

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
            // Filter out duplicates (important for shuffle mode)
            const newPhotos = data.photos.filter(
              (p) => !loadedPhotoIds.current.has(p.id)
            )
            newPhotos.forEach((p) => loadedPhotoIds.current.add(p.id))
            setPhotos((prev) => [...prev, ...newPhotos])
            currentPage.current += 1
          } else {
            // Initial load
            loadedPhotoIds.current = new Set(data.photos.map((p) => p.id))
            setPhotos(data.photos)
            currentPage.current = 2 // Next load will be page 2
          }
        }
      } catch (error) {
        console.error('Failed to fetch photos:', error)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [
      selectedEventId,
      selectedPhotographer,
      selectedCompanySlug,
      shuffle,
      groupDuplicates,
      groupScenes,
    ]
  )

  // Initial fetch when filters change (wait until localStorage check completes)
  useEffect(() => {
    if (!filtersInitialized) return
    fetchPhotos(false)
  }, [fetchPhotos, filtersInitialized])

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

  // Handle photo click - navigate to slideshow
  const handlePhotoClick = useCallback(
    (index: number) => {
      const photo = photos[index]
      if (!photo) return

      // If this is a clustered photo, get the currently displayed photo from the cluster
      const cluster = clusterMap.get(photo.id)
      const actualPhoto = cluster ? cluster.photos[cluster.currentIndex] : photo

      // Track photo click
      trackPhotoClick({
        photo_id: actualPhoto.id,
        event_id: actualPhoto.event_id || null,
        band_id: actualPhoto.band_id || null,
        event_name: actualPhoto.event_name || null,
        band_name: actualPhoto.band_name || null,
      })

      // Build slideshow URL with current filters and shuffle state
      const params = new URLSearchParams()
      if (selectedEventId) params.set('event', selectedEventId)
      if (selectedPhotographer) params.set('photographer', selectedPhotographer)
      if (selectedCompanySlug) params.set('company', selectedCompanySlug)
      if (shuffle) params.set('shuffle', shuffle)

      const queryString = params.toString()
      const slideshowUrl = `/slideshow/${actualPhoto.id}${queryString ? `?${queryString}` : ''}`
      router.push(slideshowUrl)
    },
    [
      photos,
      clusterMap,
      router,
      selectedEventId,
      selectedPhotographer,
      selectedCompanySlug,
      shuffle,
    ]
  )

  // Generate a random seed for re-shuffle
  const generateRandomSeed = useCallback(() => {
    return Math.random().toString(36).substring(2, 10)
  }, [])

  // Handle shuffle toggle
  // - OFF → ON: generate new seed (reshuffle)
  // - ON → OFF: turn off shuffle
  const handleShuffleToggle = useCallback(() => {
    if (!shuffle) {
      // Turn on shuffle with new unique seed
      const newSeed = generateRandomSeed()
      setShuffle(newSeed)
      updateUrlParams({ shuffle: newSeed })
    } else {
      // Turn off shuffle
      setShuffle(null)
      updateUrlParams({ shuffle: null })
    }
  }, [shuffle, updateUrlParams, generateRandomSeed])

  // Handle grouping toggles
  const handleGroupDuplicatesToggle = useCallback(() => {
    const newValue = !groupDuplicates
    setGroupDuplicates(newValue)
    updateUrlParams({ groupDuplicates: newValue })
  }, [groupDuplicates, updateUrlParams])

  const handleGroupScenesToggle = useCallback(() => {
    const newValue = !groupScenes
    setGroupScenes(newValue)
    updateUrlParams({ groupScenes: newValue })
  }, [groupScenes, updateUrlParams])

  // Handle cycling through cluster photos
  const handleCycleClusterPhoto = useCallback(
    (photoId: string, newIndex: number) => {
      setClusterMap((prev) => {
        const newMap = new Map(prev)
        const cluster = newMap.get(photoId)
        if (cluster) {
          newMap.set(photoId, { ...cluster, currentIndex: newIndex })
        }
        return newMap
      })
    },
    []
  )

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
                {(groupDuplicates || groupScenes) && clusterMap.size > 0 && (
                  <span className="text-text-dim">
                    {' '}
                    ({clusterMap.size} groups)
                  </span>
                )}
              </p>
            </div>
            {/* Show slideshow button if we have photos loaded OR SSR says there are photos */}
            {(photos.length > 0 || initialTotalPhotos > 0) && (
              <button
                onClick={() => handlePhotoClick(0)}
                disabled={photos.length === 0}
                className="border border-accent/40 text-accent hover:bg-accent/10 px-6 py-3 rounded-full text-xs tracking-widest uppercase font-medium flex items-center gap-2 self-start sm:self-auto transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlayCircleIcon size={16} />
                Slideshow
              </button>
            )}
          </div>

          {/* View controls - Shuffle & Size */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Shuffle button */}
            <ShuffleButton
              isActive={!!shuffle}
              onClick={handleShuffleToggle}
              size="md"
            />

            {/* Group duplicates button */}
            <GroupingButton
              isActive={groupDuplicates}
              onClick={handleGroupDuplicatesToggle}
              size="md"
              activeTitle="Duplicate grouping on"
              inactiveTitle="Group duplicate photos"
              activeLabel="Show all duplicate photos"
              inactiveLabel="Group duplicate photos"
            />

            {/* Group scenes button */}
            <GroupingButton
              isActive={groupScenes}
              onClick={handleGroupScenesToggle}
              size="md"
              activeTitle="Scene grouping on"
              inactiveTitle="Group similar scenes"
              activeLabel="Show all scenes"
              inactiveLabel="Group similar scenes"
              icon={<ScenesIcon size={18} />}
            />

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
            clusterMap={groupDuplicates || groupScenes ? clusterMap : undefined}
            onCycleClusterPhoto={handleCycleClusterPhoto}
          />
        </div>

        {/* Infinite scroll trigger */}
        <div
          ref={loadMoreRef}
          className="mt-12 h-20 flex items-center justify-center"
        >
          {loadingMore && (
            <div className="flex items-center gap-3 text-text-muted">
              <VinylSpinner size="xs" />
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
    </PublicLayout>
  )
}
