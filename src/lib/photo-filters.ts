/**
 * Photo filters — single source of truth
 *
 * The gallery, single-photo page, and slideshow all filter the same photo set
 * by the same dimensions (event, photographer, company, shuffle order, and the
 * two grouping toggles). Historically each view re-implemented the mapping
 * between its filter state, the URL query string, and the `/api/photos` request
 * params — and they drifted, which is how filters could silently reset when
 * navigating between views.
 *
 * This module owns that mapping once so every view reads, writes, and requests
 * filters identically:
 *
 * - {@link parsePhotoFilters}        URL/searchParams → PhotoFilters
 * - {@link serializePhotoFilters}    PhotoFilters → canonical query string
 * - {@link buildGalleryUrl}          PhotoFilters → /photos?… link
 * - {@link photoFiltersToApiParams}  PhotoFilters → /api/photos params
 * - {@link hasAnyPhotoFilterParam}   does a URL carry explicit filters?
 *
 * Slideshow/photo-page URLs are built with {@link buildSlideshowUrl} /
 * {@link buildPhotoUrl} in `shuffle-types`, which accept the same fields.
 */

import {
  buildPhotoApiParams,
  isShuffleEnabled,
  parseShuffleFromUrl,
  type ShuffleParam,
} from './shuffle-types'

/**
 * The complete, normalized filter state shared by every photo view.
 *
 * `null` means "no filter" for the string dimensions. Grouping defaults to
 * `true` (collapse near-duplicates and scenes), matching the gallery default.
 */
export interface PhotoFilters {
  /** Filter by event id (canonical URL param: `event`, legacy: `eventId`) */
  eventId: string | null
  /** Filter by photographer name */
  photographer: string | null
  /** Filter by company slug (`none` = photos without a company) */
  companySlug: string | null
  /**
   * Shuffle order: `null` = chronological, `'true'` = shared time-seed, or a
   * specific seed string for a shareable exact order.
   */
  shuffle: string | null
  /** Collapse near-duplicate clusters (default true) */
  groupDuplicates: boolean
  /** Collapse scene clusters (default true) */
  groupScenes: boolean
}

/** The default filter state: no filters, chronological, grouping on. */
export const DEFAULT_PHOTO_FILTERS: PhotoFilters = {
  eventId: null,
  photographer: null,
  companySlug: null,
  shuffle: null,
  groupDuplicates: true,
  groupScenes: true,
}

/**
 * Minimal read interface satisfied by both `URLSearchParams` and Next's
 * `ReadonlyURLSearchParams`.
 */
export interface ReadableSearchParams {
  get(key: string): string | null
  has(key: string): boolean
}

/** All query-param keys that represent a photo filter (including legacy). */
export const PHOTO_FILTER_PARAM_KEYS = [
  'event',
  'eventId',
  'photographer',
  'company',
  'shuffle',
  'groupDuplicates',
  'groupScenes',
] as const

/**
 * True when the URL explicitly carries at least one filter param.
 *
 * Used to decide precedence: an explicit URL always wins over a persisted
 * (localStorage) preference.
 */
export function hasAnyPhotoFilterParam(sp: ReadableSearchParams): boolean {
  return PHOTO_FILTER_PARAM_KEYS.some((key) => sp.has(key))
}

/**
 * Parse a full {@link PhotoFilters} object from URL search params.
 *
 * Absent params fall back to {@link DEFAULT_PHOTO_FILTERS}. Grouping is
 * enabled unless explicitly set to `false`. Supports the legacy `eventId`
 * param name.
 */
export function parsePhotoFilters(sp: ReadableSearchParams): PhotoFilters {
  return {
    eventId: sp.get('event') ?? sp.get('eventId') ?? null,
    photographer: sp.get('photographer') ?? null,
    companySlug: sp.get('company') ?? null,
    shuffle: parseShuffleFromUrl(sp) ?? null,
    groupDuplicates: sp.get('groupDuplicates') !== 'false',
    groupScenes: sp.get('groupScenes') !== 'false',
  }
}

/**
 * Reconcile the current filter state against the URL, updating only the
 * dimensions the URL *explicitly* specifies.
 *
 * This is what back/forward navigation and cross-view links rely on: when a
 * user lands on `/photos` with no params, persisted (localStorage) filters are
 * preserved; when a param IS present it takes precedence. Returns the same
 * reference when nothing changes so effects can depend on it cheaply.
 */
export function reconcilePhotoFiltersFromUrl(
  current: PhotoFilters,
  sp: ReadableSearchParams
): PhotoFilters {
  const next: PhotoFilters = { ...current }

  if (sp.has('event') || sp.has('eventId')) {
    next.eventId = sp.get('event') ?? sp.get('eventId') ?? null
  }
  if (sp.has('photographer')) {
    next.photographer = sp.get('photographer') || null
  }
  if (sp.has('company')) {
    next.companySlug = sp.get('company') || null
  }
  if (sp.has('shuffle')) {
    next.shuffle = parseShuffleFromUrl(sp) ?? null
  }
  if (sp.has('groupDuplicates')) {
    next.groupDuplicates = sp.get('groupDuplicates') !== 'false'
  }
  if (sp.has('groupScenes')) {
    next.groupScenes = sp.get('groupScenes') !== 'false'
  }

  return arePhotoFiltersEqual(current, next) ? current : next
}

/** Structural equality for {@link PhotoFilters}. */
export function arePhotoFiltersEqual(
  a: PhotoFilters,
  b: PhotoFilters
): boolean {
  return (
    a.eventId === b.eventId &&
    a.photographer === b.photographer &&
    a.companySlug === b.companySlug &&
    a.shuffle === b.shuffle &&
    a.groupDuplicates === b.groupDuplicates &&
    a.groupScenes === b.groupScenes
  )
}

/**
 * Serialize filters to a canonical query string (no leading `?`).
 *
 * Only non-default values appear, so a URL never carries redundant params:
 * empty string dimensions and disabled shuffle are omitted, and grouping is
 * only written when *disabled* (default is on). This keeps `/photos` clean and
 * makes the URL a faithful, minimal representation of the active filters.
 */
export function serializePhotoFilters(filters: Partial<PhotoFilters>): string {
  const params = new URLSearchParams()

  if (filters.eventId) params.set('event', filters.eventId)
  if (filters.photographer) params.set('photographer', filters.photographer)
  if (filters.companySlug) params.set('company', filters.companySlug)
  if (isShuffleEnabled(filters.shuffle as ShuffleParam)) {
    params.set('shuffle', filters.shuffle as string)
  }
  // Grouping defaults to ON — only record the exception (disabled).
  if (filters.groupDuplicates === false) params.set('groupDuplicates', 'false')
  if (filters.groupScenes === false) params.set('groupScenes', 'false')

  return params.toString()
}

/** Build a `/photos` gallery URL for the given filters. */
export function buildGalleryUrl(filters: Partial<PhotoFilters>): string {
  const query = serializePhotoFilters(filters)
  return query ? `/photos?${query}` : '/photos'
}

/**
 * Convert grouping toggles to the `groupTypes` value expected by
 * {@link buildPhotoApiParams}: `false` disables grouping entirely, otherwise a
 * comma-joined list of the enabled cluster types.
 */
export function groupTypesFromFilters(
  filters: Pick<PhotoFilters, 'groupDuplicates' | 'groupScenes'>
): string | false {
  if (!filters.groupDuplicates && !filters.groupScenes) return false
  const types: string[] = []
  if (filters.groupDuplicates) types.push('near_duplicate')
  if (filters.groupScenes) types.push('scene')
  return types.join(',')
}

/** Options for {@link photoFiltersToApiParams}. */
export interface PhotoFiltersApiOptions {
  page?: number
  limit?: number
  /** Skip filter metadata in the response (load-more requests) */
  skipMeta?: boolean
}

/**
 * Build `/api/photos` request params from filters.
 *
 * Delegates to {@link buildPhotoApiParams} so ordering (`shuffle` vs
 * `order=date`) and grouping semantics stay identical across every caller.
 */
export function photoFiltersToApiParams(
  filters: PhotoFilters,
  options: PhotoFiltersApiOptions = {}
): URLSearchParams {
  return buildPhotoApiParams({
    eventId: filters.eventId || undefined,
    photographer: filters.photographer || undefined,
    companySlug: filters.companySlug || undefined,
    shuffle: filters.shuffle,
    page: options.page,
    limit: options.limit,
    skipMeta: options.skipMeta,
    groupTypes: groupTypesFromFilters(filters),
  })
}
