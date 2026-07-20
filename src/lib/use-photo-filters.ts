'use client'

/**
 * usePhotoFilters — shared filter state + URL synchronization
 *
 * The gallery and slideshow both need the same three behaviours:
 *   1. Hold the active {@link PhotoFilters}.
 *   2. Reflect every change into the URL so navigating away and back (or
 *      sharing the link) preserves the filters.
 *   3. React to browser back/forward, which changes the URL underneath them.
 *
 * Crucially, filter changes are committed through the Next.js router
 * (`router.replace`), NOT a raw `window.history.replaceState`. The raw call
 * updated the address bar but left `useSearchParams` — and Next's internal
 * router state — stale, so a subsequent back-navigation restored an unfiltered
 * page. Routing through `router.replace` keeps the URL the single source of
 * truth and fixes that class of bug for every view that uses this hook.
 *
 * The gallery additionally opts into `localStorage` persistence so a filter set
 * on one visit is remembered on the next (when the URL carries no explicit
 * filters). The slideshow opts out.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  DEFAULT_PHOTO_FILTERS,
  hasAnyPhotoFilterParam,
  reconcilePhotoFiltersFromUrl,
  serializePhotoFilters,
  type PhotoFilters,
} from './photo-filters'

/** Fields we persist to / restore from localStorage. */
type StoredFilters = Partial<PhotoFilters>

export interface UsePhotoFiltersOptions {
  /** Server-resolved initial filters (parsed from the request URL). */
  initial: PhotoFilters
  /**
   * localStorage key. When provided, filters are restored on a fresh visit
   * (no URL filter params) and saved on every change. Omit to disable
   * persistence entirely (e.g. the slideshow).
   */
  persistKey?: string
  /**
   * Pathname that filter changes are committed to. Defaults to `/photos`.
   * The slideshow passes its per-photo path so the URL keeps the current
   * photo id.
   */
  basePath?: string
}

export interface SetFiltersOptions {
  /** Write the change to the URL (default true). */
  commitUrl?: boolean
  /** Override the pathname for this commit (defaults to `basePath`). */
  path?: string
}

export interface UsePhotoFiltersResult {
  filters: PhotoFilters
  /**
   * True once filters are ready to drive a fetch. Without persistence this is
   * always true; with persistence it flips true after the localStorage restore
   * runs, so callers can avoid an initial unfiltered fetch.
   */
  hydrated: boolean
  /** Apply a partial change; updates state and (by default) the URL. */
  setFilters: (
    patch: Partial<PhotoFilters>,
    options?: SetFiltersOptions
  ) => void
}

function pickStoredFilters(raw: unknown): StoredFilters {
  if (!raw || typeof raw !== 'object') return {}
  const s = raw as Record<string, unknown>
  const out: StoredFilters = {}
  if (typeof s.eventId === 'string' || s.eventId === null)
    out.eventId = s.eventId as string | null
  // Support the legacy `event` key that older builds persisted.
  else if (typeof s.event === 'string') out.eventId = s.event
  if (typeof s.photographer === 'string' || s.photographer === null)
    out.photographer = s.photographer as string | null
  if (typeof s.companySlug === 'string' || s.companySlug === null)
    out.companySlug = s.companySlug as string | null
  else if (typeof s.company === 'string') out.companySlug = s.company
  if (typeof s.shuffle === 'string' || s.shuffle === null)
    out.shuffle = s.shuffle as string | null
  if (typeof s.groupDuplicates === 'boolean')
    out.groupDuplicates = s.groupDuplicates
  if (typeof s.groupScenes === 'boolean') out.groupScenes = s.groupScenes
  return out
}

export function usePhotoFilters({
  initial,
  persistKey,
  basePath = '/photos',
}: UsePhotoFiltersOptions): UsePhotoFiltersResult {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Whether the URL carried explicit filters at mount. Computed once: it
  // decides whether localStorage may override (it may not when the URL wins).
  const hasUrlFiltersRef = useRef(hasAnyPhotoFilterParam(searchParams))

  const [filters, setFiltersState] = useState<PhotoFilters>(initial)
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const [hydrated, setHydrated] = useState(
    !persistKey || hasUrlFiltersRef.current
  )

  // Restore from localStorage once on mount, only when the URL has no filters.
  useEffect(() => {
    if (!persistKey || hasUrlFiltersRef.current) return
    try {
      const stored = localStorage.getItem(persistKey)
      if (stored) {
        const restored = pickStoredFilters(JSON.parse(stored))
        setFiltersState((prev) => ({ ...prev, ...restored }))
      }
    } catch {
      // Ignore malformed/unavailable storage.
    }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save to localStorage whenever filters change (after hydration).
  useEffect(() => {
    if (!persistKey || !hydrated) return
    try {
      localStorage.setItem(persistKey, JSON.stringify(filters))
    } catch {
      // Ignore storage write failures.
    }
  }, [filters, hydrated, persistKey])

  // Reconcile with the URL on back/forward (and after our own commits).
  useEffect(() => {
    setFiltersState((prev) => reconcilePhotoFiltersFromUrl(prev, searchParams))
  }, [searchParams])

  const setFilters = useCallback(
    (patch: Partial<PhotoFilters>, options: SetFiltersOptions = {}) => {
      const { commitUrl = true, path } = options
      const next = { ...filtersRef.current, ...patch }
      filtersRef.current = next
      setFiltersState(next)

      if (commitUrl) {
        const query = serializePhotoFilters(next)
        const target = `${path ?? basePath}${query ? `?${query}` : ''}`
        router.replace(target, { scroll: false })
      }
    },
    [router, basePath]
  )

  return { filters, hydrated, setFilters }
}

export { DEFAULT_PHOTO_FILTERS }
