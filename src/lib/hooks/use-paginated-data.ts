'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

interface PaginationState {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface UsePaginatedDataOptions<
  T,
  TFilters extends Record<string, string | null>,
> {
  /** API endpoint to fetch data from */
  endpoint: string
  /** Initial data (from server-side rendering) */
  initialData?: T[]
  /** Initial total count */
  initialTotal?: number
  /** Page size */
  pageSize?: number
  /** Initial filters */
  initialFilters?: TFilters
  /** Whether to sync filters with URL search params */
  syncWithUrl?: boolean
  /** Transform response data if needed */
  transformResponse?: (response: unknown) => { data: T[]; total: number }
  /** Additional query params to always include */
  additionalParams?: Record<string, string>
}

interface UsePaginatedDataReturn<
  T,
  TFilters extends Record<string, string | null>,
> {
  /** Current page of data */
  data: T[]
  /** Whether data is loading */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Pagination state */
  pagination: PaginationState
  /** Current filters */
  filters: TFilters
  /** Update a single filter */
  setFilter: <K extends keyof TFilters>(key: K, value: TFilters[K]) => void
  /** Clear all filters */
  clearFilters: () => void
  /** Go to specific page */
  goToPage: (page: number) => void
  /** Go to next page */
  nextPage: () => void
  /** Go to previous page */
  prevPage: () => void
  /** Refresh data */
  refresh: () => Promise<void>
  /** Whether there are more pages */
  hasMore: boolean
  /** Whether we're on the first page */
  isFirstPage: boolean
  /** Whether we're on the last page */
  isLastPage: boolean
}

/**
 * Custom hook for managing paginated data with filters.
 * Handles URL synchronization, loading states, and pagination logic.
 *
 * Usage:
 * ```tsx
 * const {
 *   data: photos,
 *   isLoading,
 *   pagination,
 *   filters,
 *   setFilter,
 *   goToPage,
 * } = usePaginatedData<Photo, PhotoFilters>({
 *   endpoint: '/api/photos',
 *   initialData: serverPhotos,
 *   initialTotal: serverTotal,
 *   pageSize: 50,
 *   syncWithUrl: true,
 * })
 * ```
 */
export function usePaginatedData<
  T,
  TFilters extends Record<string, string | null>,
>({
  endpoint,
  initialData = [],
  initialTotal = 0,
  pageSize = 50,
  initialFilters = {} as TFilters,
  syncWithUrl = false,
  transformResponse,
  additionalParams = {},
}: UsePaginatedDataOptions<T, TFilters>): UsePaginatedDataReturn<T, TFilters> {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Initialize filters from URL if syncing
  const getInitialFilters = (): TFilters => {
    if (!syncWithUrl) return initialFilters

    const urlFilters = { ...initialFilters }
    for (const key of Object.keys(initialFilters)) {
      const urlValue = searchParams.get(key)
      if (urlValue !== null) {
        ;(urlFilters as Record<string, string | null>)[key] = urlValue
      }
    }
    return urlFilters
  }

  const getInitialPage = (): number => {
    if (!syncWithUrl) return 1
    const pageParam = searchParams.get('page')
    return pageParam ? parseInt(pageParam, 10) : 1
  }

  const [data, setData] = useState<T[]>(initialData)
  const [total, setTotal] = useState(initialTotal)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<TFilters>(getInitialFilters)
  const [page, setPage] = useState(getInitialPage)

  // Track if we need to fetch (vs using initial data)
  const hasFetched = useRef(false)
  const isInitialMount = useRef(true)

  // Calculate pagination state
  const pagination: PaginationState = {
    page,
    limit: pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  }

  // Build query string from filters
  const buildQueryString = (
    currentFilters: TFilters,
    currentPage: number
  ): string => {
    const params = new URLSearchParams()

    // Add filters
    for (const [key, value] of Object.entries(currentFilters)) {
      if (value) {
        params.set(key, value)
      }
    }

    // Add pagination
    params.set('page', currentPage.toString())
    params.set('limit', pageSize.toString())

    // Add additional params
    for (const [key, value] of Object.entries(additionalParams)) {
      params.set(key, value)
    }

    return params.toString()
  }

  // Fetch data from API
  const fetchData = async (
    currentFilters: TFilters,
    currentPage: number
  ): Promise<void> => {
    setIsLoading(true)
    setError(null)

    try {
      const queryString = buildQueryString(currentFilters, currentPage)
      const response = await fetch(`${endpoint}?${queryString}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`)
      }

      const json = await response.json()

      let newData: T[]
      let newTotal: number

      if (transformResponse) {
        const transformed = transformResponse(json)
        newData = transformed.data
        newTotal = transformed.total
      } else {
        // Default: expect { data: T[], pagination: { total: number } } or { items: T[], total: number }
        newData = json.data ?? json.items ?? json.photos ?? []
        newTotal = json.pagination?.total ?? json.total ?? 0
      }

      setData(newData)
      setTotal(newTotal)
      hasFetched.current = true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setIsLoading(false)
    }
  }

  // Update URL when filters or page change
  const updateUrl = (currentFilters: TFilters, currentPage: number): void => {
    if (!syncWithUrl) return

    const params = new URLSearchParams()

    for (const [key, value] of Object.entries(currentFilters)) {
      if (value) {
        params.set(key, value)
      }
    }

    if (currentPage > 1) {
      params.set('page', currentPage.toString())
    }

    const queryString = params.toString()
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname

    router.replace(newUrl, { scroll: false })
  }

  // Set a single filter
  const setFilter = <K extends keyof TFilters>(
    key: K,
    value: TFilters[K]
  ): void => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1) // Reset to page 1 when filter changes
  }

  // Clear all filters
  const clearFilters = (): void => {
    const emptyFilters = Object.keys(initialFilters).reduce(
      (acc, key) => ({ ...acc, [key]: null }),
      {} as TFilters
    )
    setFilters(emptyFilters)
    setPage(1)
  }

  // Page navigation
  const goToPage = (newPage: number): void => {
    const validPage = Math.max(1, Math.min(newPage, pagination.totalPages || 1))
    setPage(validPage)
  }

  const nextPage = (): void => {
    if (page < pagination.totalPages) {
      setPage((prev) => prev + 1)
    }
  }

  const prevPage = (): void => {
    if (page > 1) {
      setPage((prev) => prev - 1)
    }
  }

  // Refresh data
  const refresh = async (): Promise<void> => {
    await fetchData(filters, page)
  }

  // Fetch data when filters or page change
  useEffect(() => {
    // Skip initial fetch if we have initial data
    if (isInitialMount.current) {
      isInitialMount.current = false
      if (initialData.length > 0) {
        return
      }
    }

    fetchData(filters, page)
    updateUrl(filters, page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, initialData.length])

  return {
    data,
    isLoading,
    error,
    pagination,
    filters,
    setFilter,
    clearFilters,
    goToPage,
    nextPage,
    prevPage,
    refresh,
    hasMore: page < pagination.totalPages,
    isFirstPage: page === 1,
    isLastPage: page >= pagination.totalPages,
  }
}
