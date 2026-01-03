'use client'

import { useState, useEffect, useRef } from 'react'
import type { Photo } from '@/lib/db-types'
import {
  type ShuffleParam,
  type ShuffleState,
  buildPhotoApiParams,
  buildPhotoUrl,
  generateShuffleSeed,
  createShuffleStateFromParam,
} from '@/lib/shuffle-types'

/**
 * API response shape for /api/photos
 */
interface PhotosApiResponse {
  photos: Photo[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  seed?: string
  photographers?: string[]
  companies?: { slug: string; name: string }[]
}

/**
 * Options for useShuffledPhotos hook
 */
export interface UseShuffledPhotosOptions {
  /** Filter by event ID */
  eventId?: string | null
  /** Filter by band ID */
  bandId?: string | null
  /** Filter by photographer name */
  photographer?: string | null
  /** Filter by company slug */
  companySlug?: string | null
  /** Initial shuffle state from URL or default */
  initialShuffle?: ShuffleParam
  /** Page size for pagination */
  pageSize?: number
  /** Initial photos (from server-side rendering) */
  initialPhotos?: Photo[]
  /** Initial total count */
  initialTotalCount?: number
  /** Callback when shuffle state changes */
  onShuffleChange?: (shuffle: ShuffleState) => void
  /**
   * Group types for photo clustering.
   * - undefined: uses default ('near_duplicate,scene') via buildPhotoApiParams
   * - string: custom group types
   * - false: disable grouping entirely
   */
  groupTypes?: string | false
}

/**
 * Return value from useShuffledPhotos hook
 */
export interface UseShuffledPhotosResult {
  /** Loaded photos */
  photos: Photo[]
  /** Total count of photos matching filters */
  totalCount: number
  /** Current shuffle state */
  shuffle: ShuffleState
  /** Toggle shuffle on/off */
  toggleShuffle: () => void
  /** Generate new shuffle (reshuffle) */
  reshuffle: () => void
  /** Set shuffle to a specific seed */
  setShuffle: (shuffle: ShuffleParam) => void
  /** Whether initial data is loading */
  loading: boolean
  /** Whether more data is being loaded */
  loadingMore: boolean
  /** Load more photos (for infinite scroll) */
  loadMore: () => Promise<void>
  /** Refresh photos (re-fetch current page) */
  refresh: () => Promise<void>
  /** Build photo page URL with correct shuffle param */
  buildPhotoUrl: (photoSlug: string) => string
  /** Whether there are more photos to load */
  hasMore: boolean
  /** Current page number */
  currentPage: number
}

const DEFAULT_PAGE_SIZE = 50

/**
 * Unified hook for managing shuffled photos
 *
 * This hook handles:
 * - Fetching photos with consistent shuffle parameters
 * - Shuffle state management (on/off/reshuffle)
 * - Pagination with infinite scroll support
 * - Building slideshow URLs with correct params
 *
 * It's the single source of truth for shuffle behavior, ensuring
 * gallery, photo-strip, and slideshow all use consistent APIs.
 *
 * Note: React Compiler handles memoization automatically, so we don't
 * use useCallback/useMemo manually per doc/practices/react.md.
 *
 * @example
 * ```tsx
 * const {
 *   photos,
 *   shuffle,
 *   toggleShuffle,
 *   loadMore,
 *   buildSlideshowUrl,
 * } = useShuffledPhotos({
 *   eventId: 'event-123',
 *   initialShuffle: 'true',
 * })
 *
 * // Navigate to slideshow preserving shuffle order
 * const url = buildSlideshowUrl(photos[0].id)
 * router.push(url)
 * ```
 */
export function useShuffledPhotos(
  options: UseShuffledPhotosOptions = {}
): UseShuffledPhotosResult {
  const {
    eventId,
    bandId,
    photographer,
    companySlug,
    initialShuffle = 'true', // Default to shuffle enabled
    pageSize = DEFAULT_PAGE_SIZE,
    initialPhotos,
    initialTotalCount,
    onShuffleChange,
    groupTypes,
  } = options

  // Photos state
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos || [])
  const [totalCount, setTotalCount] = useState(initialTotalCount || 0)

  // Shuffle state
  const [shuffle, setShuffleState] = useState<ShuffleState>(() =>
    createShuffleStateFromParam(initialShuffle)
  )

  // Loading state - not loading if we have initial photos
  const [loading, setLoading] = useState(!initialPhotos)
  const [loadingMore, setLoadingMore] = useState(false)

  // Pagination state
  const [currentPageNum, setCurrentPageNum] = useState(1)
  const loadedPhotoIds = useRef<Set<string>>(
    new Set(initialPhotos?.map((p) => p.id) || [])
  )

  // Track fetch state to avoid duplicate fetches
  const isFetching = useRef(false)
  const isInitialMount = useRef(true)

  // Store callback ref to avoid dependency issues
  const onShuffleChangeRef = useRef(onShuffleChange)
  onShuffleChangeRef.current = onShuffleChange

  /**
   * Fetch photos from API
   * React Compiler will memoize this automatically
   */
  async function doFetch(
    page: number,
    isLoadMore: boolean,
    shuffleState: ShuffleState
  ): Promise<void> {
    if (isFetching.current) return
    isFetching.current = true

    if (isLoadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      // Build params using type-safe helper
      const params = buildPhotoApiParams({
        eventId: eventId || undefined,
        bandId: bandId || undefined,
        photographer: photographer || undefined,
        companySlug: companySlug || undefined,
        shuffle: shuffleState.enabled ? shuffleState.seed || 'true' : null,
        page,
        limit: pageSize,
        skipMeta: isLoadMore, // Skip metadata on load-more
        groupTypes,
      })

      const res = await fetch(`/api/photos?${params.toString()}`)
      if (!res.ok) {
        throw new Error(`Failed to fetch photos: ${res.statusText}`)
      }

      const data: PhotosApiResponse = await res.json()

      // Update total count
      setTotalCount(data.pagination.total)

      // Resolve seed from API response (only if we sent 'true')
      if (data.seed && shuffleState.enabled && !shuffleState.seed) {
        setShuffleState({ enabled: true, seed: data.seed })
        onShuffleChangeRef.current?.({ enabled: true, seed: data.seed })
      }

      if (isLoadMore) {
        // Filter duplicates and append
        const newPhotos = data.photos.filter(
          (p) => !loadedPhotoIds.current.has(p.id)
        )
        newPhotos.forEach((p) => loadedPhotoIds.current.add(p.id))
        setPhotos((prev) => [...prev, ...newPhotos])
        setCurrentPageNum(page)
      } else {
        // Replace photos
        loadedPhotoIds.current = new Set(data.photos.map((p) => p.id))
        setPhotos(data.photos)
        setCurrentPageNum(1)
      }
    } catch (error) {
      console.error('Failed to fetch photos:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      isFetching.current = false
    }
  }

  /**
   * Load more photos (for infinite scroll)
   */
  async function loadMore(): Promise<void> {
    if (loadingMore || isFetching.current || photos.length >= totalCount) return
    await doFetch(currentPageNum + 1, true, shuffle)
  }

  /**
   * Refresh photos (re-fetch first page)
   */
  async function refresh(): Promise<void> {
    await doFetch(1, false, shuffle)
  }

  /**
   * Toggle shuffle on/off
   * - OFF → ON: generate new seed
   * - ON → OFF: disable shuffle
   */
  function toggleShuffle(): void {
    if (shuffle.enabled) {
      // Turn off shuffle
      const newState: ShuffleState = { enabled: false, seed: null }
      setShuffleState(newState)
      onShuffleChangeRef.current?.(newState)
    } else {
      // Turn on shuffle with new seed
      const newSeed = generateShuffleSeed()
      const newState: ShuffleState = { enabled: true, seed: newSeed }
      setShuffleState(newState)
      onShuffleChangeRef.current?.(newState)
    }
  }

  /**
   * Generate new shuffle (reshuffle)
   */
  function reshuffle(): void {
    const newSeed = generateShuffleSeed()
    const newState: ShuffleState = { enabled: true, seed: newSeed }
    setShuffleState(newState)
    onShuffleChangeRef.current?.(newState)
  }

  /**
   * Set shuffle to a specific value
   */
  function setShuffle(shuffleParam: ShuffleParam): void {
    const newState = createShuffleStateFromParam(shuffleParam)
    setShuffleState(newState)
    onShuffleChangeRef.current?.(newState)
  }

  /**
   * Build photo page URL with correct shuffle param
   * @param photoSlug - The photo's slug (preferred) or ID (fallback)
   */
  function buildPhotoUrlForPhoto(photoSlug: string): string {
    return buildPhotoUrl({
      photoSlug,
      eventId: eventId || undefined,
      bandId: bandId || undefined,
      photographer: photographer || undefined,
      companySlug: companySlug || undefined,
      shuffle: shuffle.enabled ? shuffle.seed : null,
    })
  }

  // Compute hasMore based on current state
  const hasMore = photos.length < totalCount

  // Initial fetch and fetch when filters or shuffle change
  useEffect(() => {
    // Skip initial fetch if we have initial photos
    if (isInitialMount.current && initialPhotos && initialPhotos.length > 0) {
      isInitialMount.current = false
      return
    }
    isInitialMount.current = false

    doFetch(1, false, shuffle)
    // Note: doFetch is defined inside the component and React Compiler
    // handles its memoization. We list the dependencies that should trigger refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    eventId,
    bandId,
    photographer,
    companySlug,
    shuffle.enabled,
    shuffle.seed,
    groupTypes,
  ])

  return {
    photos,
    totalCount,
    shuffle,
    toggleShuffle,
    reshuffle,
    setShuffle,
    loading,
    loadingMore,
    loadMore,
    refresh,
    buildPhotoUrl: buildPhotoUrlForPhoto,
    hasMore,
    currentPage: currentPageNum,
  }
}
