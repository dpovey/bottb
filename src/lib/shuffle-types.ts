/**
 * Type-safe shuffle types and helpers
 *
 * This module provides a single source of truth for shuffle semantics,
 * eliminating the confusion between different parameter names (shuffle vs seed)
 * and different API patterns (shuffle=X vs order=random&seed=X).
 */

/**
 * Default group types for photo galleries
 *
 * When grouping is enabled (default), these cluster types are collapsed:
 * - 'near_duplicate': Nearly identical photos (burst shots, minor variations)
 * - 'scene': Same scene with different framing/crops
 *
 * All photo-fetching code should use this constant (or buildPhotoApiParams
 * which uses it by default) to ensure consistent behavior across:
 * - Gallery grid
 * - Photo strips
 * - Slideshow
 */
export const DEFAULT_GROUP_TYPES = 'near_duplicate,scene'

/**
 * Shuffle parameter: controls photo ordering
 *
 * Values:
 * - 'true' → shared time-based seed (all users see same order in 15-min window)
 * - string → specific seed (for shareable links with exact order)
 * - null/undefined → chronological order by date (shuffle disabled)
 *
 * Note: 'false' is equivalent to null (shuffle disabled)
 */
export type ShuffleParam = 'true' | string | null | undefined

/**
 * Resolved shuffle state after API call
 *
 * When the API returns, 'true' is resolved to an actual seed string.
 * This state represents what the client knows after fetching.
 */
export interface ShuffleState {
  /** Whether shuffle is currently enabled */
  enabled: boolean
  /** The actual seed string used (resolved from 'true' or passed directly) */
  seed: string | null
}

/**
 * Check if shuffle is enabled
 */
export function isShuffleEnabled(shuffle: ShuffleParam): boolean {
  return shuffle !== null && shuffle !== undefined && shuffle !== 'false'
}

/**
 * Parse shuffle param from URL search params
 *
 * @param searchParams - URL search params
 * @returns ShuffleParam - The shuffle value from URL, or null if not present
 */
export function parseShuffleFromUrl(
  searchParams: URLSearchParams | { get: (key: string) => string | null }
): ShuffleParam {
  const value = searchParams.get('shuffle')
  if (value === null || value === 'false') {
    return null
  }
  return value
}

/**
 * Generate a random shuffle seed
 *
 * Creates a URL-safe random string that can be used as a shuffle seed.
 * Same seed always produces the same shuffle order (deterministic).
 */
export function generateShuffleSeed(): string {
  return Math.random().toString(36).substring(2, 10)
}

/**
 * Photo order types for non-shuffle mode
 */
export type PhotoOrder = 'date' | 'uploaded'

/**
 * Options for building photo API params
 */
export interface PhotoApiParamsOptions {
  /** Filter by event ID */
  eventId?: string
  /** Filter by band ID */
  bandId?: string
  /** Filter by photographer name */
  photographer?: string
  /** Filter by company slug */
  companySlug?: string
  /** Shuffle parameter: 'true', specific seed, or null/undefined for no shuffle */
  shuffle?: ShuffleParam
  /** Order when shuffle is disabled (default: 'date' for chronological) */
  order?: PhotoOrder
  /** Page number (1-indexed) */
  page?: number
  /** Items per page */
  limit?: number
  /** Skip metadata (for load-more requests) */
  skipMeta?: boolean
  /**
   * Group types for photo clustering.
   * - undefined: uses DEFAULT_GROUP_TYPES ('near_duplicate,scene')
   * - string: custom group types (e.g., 'near_duplicate' only)
   * - false: disable grouping entirely
   */
  groupTypes?: string | false
}

/**
 * Build type-safe API params for fetching photos
 *
 * This is the SINGLE source of truth for building photo API request params.
 * All photo fetching code should use this function to ensure consistency.
 *
 * Guarantees:
 * - Uses 'shuffle' param (never 'seed' or 'order=random')
 * - Consistent parameter naming
 * - Type-safe options
 *
 * @example
 * ```ts
 * const params = buildPhotoApiParams({
 *   eventId: 'event-123',
 *   shuffle: 'abc123',
 *   page: 1,
 *   limit: 50,
 * })
 * fetch(`/api/photos?${params.toString()}`)
 * ```
 */
export function buildPhotoApiParams(
  options: PhotoApiParamsOptions
): URLSearchParams {
  const {
    eventId,
    bandId,
    photographer,
    companySlug,
    shuffle,
    order = 'date', // Default to chronological order when shuffle disabled
    page,
    limit,
    skipMeta,
    groupTypes,
  } = options

  const params = new URLSearchParams()

  // Filters
  if (eventId) params.set('event', eventId)
  if (bandId) params.set('band', bandId)
  if (photographer) params.set('photographer', photographer)
  if (companySlug) params.set('company', companySlug)

  // Ordering: shuffle takes precedence, otherwise use order param
  if (isShuffleEnabled(shuffle)) {
    params.set('shuffle', shuffle!)
  } else {
    params.set('order', order)
  }

  // Pagination
  if (page !== undefined) params.set('page', page.toString())
  if (limit !== undefined) params.set('limit', limit.toString())

  // Optimization flags
  if (skipMeta) params.set('skipMeta', 'true')

  // Photo grouping - defaults to DEFAULT_GROUP_TYPES for consistent behavior
  // Pass groupTypes: false to disable grouping
  if (groupTypes !== false) {
    const resolvedGroupTypes = groupTypes ?? DEFAULT_GROUP_TYPES
    params.set('groupTypes', resolvedGroupTypes)
  }

  return params
}

/**
 * Options for building slideshow URL
 */
export interface SlideshowUrlOptions {
  /** Photo ID (required) */
  photoId: string
  /** Filter by event ID */
  eventId?: string
  /** Filter by band ID */
  bandId?: string
  /** Filter by photographer name */
  photographer?: string
  /** Filter by company slug */
  companySlug?: string
  /** Shuffle seed to preserve order */
  shuffle?: ShuffleParam
}

/**
 * Build slideshow URL with correct shuffle param
 *
 * This ensures the shuffle seed is passed correctly to the slideshow page,
 * maintaining the same photo order as the gallery/photo-strip.
 *
 * @example
 * ```ts
 * const url = buildSlideshowUrl({
 *   photoId: 'photo-123',
 *   eventId: 'event-456',
 *   shuffle: 'abc123',
 * })
 * // Returns: /slideshow/photo-123?event=event-456&shuffle=abc123
 * ```
 */
export function buildSlideshowUrl(options: SlideshowUrlOptions): string {
  const { photoId, eventId, bandId, photographer, companySlug, shuffle } =
    options

  const params = new URLSearchParams()

  // Filters
  if (eventId) params.set('event', eventId)
  if (bandId) params.set('band', bandId)
  if (photographer) params.set('photographer', photographer)
  if (companySlug) params.set('company', companySlug)

  // Shuffle - use the actual seed, not 'true'
  // If shuffle is 'true', caller should have resolved it to actual seed first
  if (isShuffleEnabled(shuffle)) {
    params.set('shuffle', shuffle!)
  }

  const queryString = params.toString()
  return `/slideshow/${photoId}${queryString ? `?${queryString}` : ''}`
}

/**
 * Create initial shuffle state from URL param
 *
 * Use this when initializing state from URL search params.
 * The 'enabled' field will be true if shuffle param exists,
 * but 'seed' will be null until resolved by API response.
 */
export function createShuffleStateFromParam(
  shuffle: ShuffleParam
): ShuffleState {
  if (!isShuffleEnabled(shuffle)) {
    return { enabled: false, seed: null }
  }

  // If shuffle is 'true', seed is not yet resolved
  // If shuffle is a specific seed, use it directly
  return {
    enabled: true,
    seed: shuffle === 'true' ? null : shuffle!,
  }
}

/**
 * Update shuffle state with resolved seed from API response
 *
 * Call this after fetching photos when the API returns the actual seed used.
 */
export function resolveShuffleSeed(
  state: ShuffleState,
  resolvedSeed: string | null
): ShuffleState {
  if (!state.enabled) {
    return state
  }

  return {
    enabled: true,
    seed: resolvedSeed || state.seed,
  }
}
