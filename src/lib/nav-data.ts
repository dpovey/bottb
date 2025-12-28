'use cache'

import { cacheLife, cacheTag } from 'next/cache'
import {
  getPastEventsWithWinners,
  getUpcomingEvents,
  getCompanies,
  getCompanyBySlug,
  getCompanyBands,
  getEvents,
  getBands,
  getDistinctCompanies,
  getVideos,
  getPhotosWithCount,
  getAvailablePhotoFilters,
  type CompanyWithStats,
  type Company,
  type Band,
  type Video,
  type Photo,
} from './db'

export interface NavEvent {
  id: string
  name: string
  date: string
  location: string
  status: 'upcoming' | 'voting' | 'finalized'
  info?: {
    winner?: string
    winner_company_slug?: string
    winner_company_name?: string
    winner_company_icon_url?: string
    [key: string]: unknown
  }
}

interface EventInfo {
  winner?: string
  winner_company_slug?: string
  winner_company_name?: string
  winner_company_icon_url?: string
  [key: string]: unknown
}

/**
 * Get events for navigation dropdown - cached for 5 minutes
 */
export async function getNavEvents(): Promise<{
  upcoming: NavEvent[]
  past: NavEvent[]
}> {
  cacheLife('fiveMinutes')
  cacheTag('nav-events')

  const [pastEventsRaw, upcomingEvents] = await Promise.all([
    getPastEventsWithWinners(),
    getUpcomingEvents(),
  ])

  // Process past events to merge winner info into info object
  const pastEvents = pastEventsRaw.map((event) => {
    const eventInfo = event.info as EventInfo | null

    if (event.winner_band_name) {
      return {
        id: event.id,
        name: event.name,
        date: event.date,
        location: event.location,
        status: event.status,
        info: {
          ...eventInfo,
          winner: event.winner_band_name,
          winner_company_slug: event.winner_company_slug,
          winner_company_name: event.winner_company_name,
          winner_company_icon_url: event.winner_company_icon_url,
        },
      } as NavEvent
    }

    return {
      id: event.id,
      name: event.name,
      date: event.date,
      location: event.location,
      status: event.status,
      info: eventInfo,
    } as NavEvent
  })

  // Sort past events by date descending and take first 5
  const sortedPast = pastEvents
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  return {
    upcoming: upcomingEvents.map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      location: e.location,
      status: e.status,
      info: e.info as EventInfo | undefined,
    })),
    past: sortedPast,
  }
}

/**
 * Get all companies with stats - cached for 5 minutes
 */
export async function getCachedCompanies(): Promise<CompanyWithStats[]> {
  cacheLife('fiveMinutes')
  cacheTag('companies')

  return getCompanies()
}

export interface CompanyBand extends Band {
  event_name: string
  event_date: string
}

/**
 * Get company details with bands - cached for 5 minutes
 */
export async function getCachedCompanyWithBands(
  slug: string
): Promise<{ company: Company | null; bands: CompanyBand[] }> {
  cacheLife('fiveMinutes')
  cacheTag('companies', `company-${slug}`)

  const [company, bands] = await Promise.all([
    getCompanyBySlug(slug),
    getCompanyBands(slug),
  ])
  return { company, bands: bands as CompanyBand[] }
}

// ============================================================
// Filter Options (for Photos/Videos pages)
// ============================================================

export interface FilterOptions {
  events: Array<{ id: string; name: string; date: string }>
  bands: Array<{
    id: string
    name: string
    event_id: string
    company_slug?: string
  }>
  companies: Array<{ slug: string; name: string }>
}

/**
 * Get filter options for photos/videos pages - cached for 5 minutes
 */
export async function getCachedFilterOptions(): Promise<FilterOptions> {
  cacheLife('fiveMinutes')
  cacheTag('filter-options')

  const [events, bands, companies] = await Promise.all([
    getEvents(),
    getBands(),
    getDistinctCompanies(),
  ])

  // Sort events by date descending
  const sortedEvents = events
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((e) => ({ id: e.id, name: e.name, date: e.date }))

  return {
    events: sortedEvents,
    bands: bands.map((b) => ({
      id: b.id,
      name: b.name,
      event_id: b.event_id,
      company_slug: b.company_slug,
    })),
    companies,
  }
}

// ============================================================
// Photos Data (with shuffle support)
// ============================================================

// Re-export shuffle utilities from dedicated module
export { seededShuffle, getTimeBasedSeed } from './shuffle'
import { seededShuffle, getTimeBasedSeed } from './shuffle'

export interface CachedPhotosOptions {
  eventId?: string
  photographer?: string
  companySlug?: string
  shuffle?: string | null // 'true' for shared shuffle, or a specific seed
  limit?: number
  offset?: number
}

export interface CachedPhotosResult {
  photos: Photo[]
  total: number
  seed: string | null // The actual seed used (for client to track)
}

/**
 * Get photos with optional shuffle - cached for 15 minutes
 *
 * Shuffle behavior:
 * - shuffle='true' → uses time-based seed (shared by all users in 15-min window)
 * - shuffle='<seed>' → uses specific seed (for re-shuffles and shared links)
 * - shuffle=null/undefined → ordered by date (no shuffle)
 *
 * The cache key includes the seed, so different seeds = different cache entries.
 * Same seed always produces the same order (deterministic), with or without cache.
 */
export async function getCachedPhotos(
  options: CachedPhotosOptions
): Promise<CachedPhotosResult> {
  const {
    eventId,
    photographer,
    companySlug,
    shuffle,
    limit = 50,
    offset = 0,
  } = options

  // Determine the seed to use
  let seed: string | null = null
  if (shuffle === 'true') {
    // Shared shuffle: use time-based seed
    seed = getTimeBasedSeed()
  } else if (shuffle && shuffle !== 'false') {
    // Specific shuffle: use provided seed
    seed = shuffle
  }

  // Set cache profile and tags
  // Cache key automatically includes all function arguments
  cacheLife('fifteenMinutes')
  cacheTag('photos', seed ? `photos-shuffle-${seed}` : 'photos-date')

  // Always fetch by date order from DB, then shuffle in memory if needed
  const { photos, total } = await getPhotosWithCount({
    eventId,
    photographer,
    companySlug,
    limit: seed ? limit * 2 : limit, // Fetch more for shuffle to allow better distribution
    offset: seed ? 0 : offset, // For shuffle, always start from beginning
    orderBy: 'date',
  })

  if (seed) {
    // Apply deterministic shuffle
    const shuffledPhotos = seededShuffle(photos, seed)
    // Apply pagination after shuffle
    const paginatedPhotos = shuffledPhotos.slice(offset, offset + limit)
    return { photos: paginatedPhotos, total, seed }
  }

  return { photos, total, seed: null }
}

/**
 * Get available photo filters - cached for 15 minutes
 */
export async function getCachedPhotoFilters(options: {
  eventId?: string
  photographer?: string
  companySlug?: string
}) {
  cacheLife('fifteenMinutes')
  cacheTag('photo-filters')

  return getAvailablePhotoFilters(options)
}

// ============================================================
// Videos Data
// ============================================================

export interface VideosData {
  videos: Video[]
  filterOptions: FilterOptions
}

/**
 * Get videos with filter options - cached for 5 minutes
 */
export async function getCachedVideosData(
  eventId?: string,
  companySlug?: string
): Promise<VideosData> {
  cacheLife('fiveMinutes')
  cacheTag('videos')

  const [videos, filterOptions] = await Promise.all([
    getVideos({ eventId, companySlug, limit: 100 }),
    getCachedFilterOptions(),
  ])

  return { videos, filterOptions }
}
