'use client'

import { useCallback, useEffect, useState } from 'react'
import { Photo } from '@/lib/db'

interface Filters {
  eventId?: string | null
  bandId?: string | null
  photographer?: string | null
  companySlug?: string | null
}

interface UseSlideshowPaginationOptions {
  initialPhotos: Photo[]
  initialPage: number
  totalPhotos: number
  filters: Filters
  currentIndex: number
  pageSize?: number
  prefetchThreshold?: number
}

interface UseSlideshowPaginationReturn {
  allPhotos: Photo[]
  setAllPhotos: React.Dispatch<React.SetStateAction<Photo[]>>
  totalCount: number
  isLoadingMore: boolean
  loadedPages: Set<number>
  loadNextPage: () => Promise<void>
  loadPrevPage: () => Promise<void>
  minLoadedPage: number
}

const DEFAULT_PAGE_SIZE = 50
const DEFAULT_PREFETCH_THRESHOLD = 15

/**
 * Custom hook for managing photo pagination and lazy loading in the slideshow.
 * Handles bidirectional infinite scrolling with deduplication.
 */
export function useSlideshowPagination({
  initialPhotos,
  initialPage,
  totalPhotos,
  filters,
  currentIndex,
  pageSize = DEFAULT_PAGE_SIZE,
  prefetchThreshold = DEFAULT_PREFETCH_THRESHOLD,
}: UseSlideshowPaginationOptions): UseSlideshowPaginationReturn {
  const [allPhotos, setAllPhotos] = useState<Photo[]>(initialPhotos)
  const [loadedPages, setLoadedPages] = useState<Set<number>>(
    new Set([initialPage])
  )
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState(totalPhotos)

  // Sync photos from parent without resetting position (e.g., after crop updates)
  useEffect(() => {
    setAllPhotos(initialPhotos)
  }, [initialPhotos])

  // Sync totalCount when parent's totalPhotos changes
  useEffect(() => {
    if (totalPhotos > 0 && totalCount === 0) {
      setTotalCount(totalPhotos)
    }
  }, [totalPhotos, totalCount])

  // Fetch a specific page of photos
  const fetchPage = useCallback(
    async (page: number): Promise<Photo[]> => {
      const params = new URLSearchParams()
      if (filters.eventId) params.set('event', filters.eventId)
      if (filters.bandId) params.set('band', filters.bandId)
      if (filters.photographer) params.set('photographer', filters.photographer)
      if (filters.companySlug) params.set('company', filters.companySlug)
      params.set('page', page.toString())
      params.set('limit', pageSize.toString())
      params.set('order', 'date') // Chronological order for slideshow viewing

      const res = await fetch(`/api/photos?${params.toString()}`)
      if (!res.ok) return []

      const data = await res.json()
      setTotalCount(data.pagination.total)
      return data.photos
    },
    [filters, pageSize]
  )

  // Load next page
  const loadNextPage = useCallback(async () => {
    const nextPage = Math.max(...Array.from(loadedPages)) + 1
    const maxPage = Math.ceil(totalCount / pageSize)

    if (nextPage > maxPage || loadedPages.has(nextPage) || isLoadingMore) return

    setIsLoadingMore(true)
    try {
      const newPhotos = await fetchPage(nextPage)
      if (newPhotos.length > 0) {
        setAllPhotos((prev) => {
          // Deduplicate by filtering out photos that already exist
          const existingIds = new Set(prev.map((p) => p.id))
          const uniqueNewPhotos = newPhotos.filter(
            (p) => !existingIds.has(p.id)
          )
          return [...prev, ...uniqueNewPhotos]
        })
        setLoadedPages((prev) => new Set([...prev, nextPage]))
      }
    } finally {
      setIsLoadingMore(false)
    }
  }, [loadedPages, totalCount, isLoadingMore, fetchPage, pageSize])

  // Load previous page
  const loadPrevPage = useCallback(async () => {
    const prevPage = Math.min(...Array.from(loadedPages)) - 1

    if (prevPage < 1 || loadedPages.has(prevPage) || isLoadingMore) return

    setIsLoadingMore(true)
    try {
      const newPhotos = await fetchPage(prevPage)
      if (newPhotos.length > 0) {
        setAllPhotos((prev) => {
          const existingIds = new Set(prev.map((p) => p.id))
          const uniqueNewPhotos = newPhotos.filter(
            (p) => !existingIds.has(p.id)
          )
          return [...uniqueNewPhotos, ...prev]
        })
        setLoadedPages((prev) => new Set([...prev, prevPage]))
      }
    } finally {
      setIsLoadingMore(false)
    }
  }, [loadedPages, isLoadingMore, fetchPage])

  // Aggressive initial load - fill thumbnail strip
  useEffect(() => {
    if (totalCount === 0) return

    // Calculate minimum photos to fill thumbnail strip (2x viewport width)
    const minThumbnailPhotos = Math.ceil((window.innerWidth * 2) / 76)

    const needsMore = allPhotos.length < minThumbnailPhotos
    const hasMore = allPhotos.length < totalCount

    if (needsMore && hasMore && !isLoadingMore) {
      loadNextPage()
    }
  }, [allPhotos.length, totalCount, isLoadingMore, loadNextPage])

  // Prefetch based on navigation
  useEffect(() => {
    // Near the end - load next page
    if (currentIndex >= allPhotos.length - prefetchThreshold) {
      loadNextPage()
    }
    // Near the beginning - load previous page
    if (currentIndex < prefetchThreshold) {
      loadPrevPage()
    }
  }, [
    currentIndex,
    allPhotos.length,
    loadNextPage,
    loadPrevPage,
    prefetchThreshold,
  ])

  const minLoadedPage = Math.min(...Array.from(loadedPages))

  return {
    allPhotos,
    setAllPhotos,
    totalCount,
    isLoadingMore,
    loadedPages,
    loadNextPage,
    loadPrevPage,
    minLoadedPage,
  }
}
