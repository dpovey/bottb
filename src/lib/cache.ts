import { unstable_cache } from "next/cache";

/**
 * Cache configuration for database queries
 * Uses Next.js unstable_cache for server-side caching
 */

const CACHE_TAGS = {
  events: "events",
  activeEvent: "active-event",
  pastEvents: "past-events",
  upcomingEvents: "upcoming-events",
  finalizedResults: "finalized-results",
  photos: "photos",
  videos: "videos",
  companies: "companies",
} as const;

/**
 * Cache event data for 60 seconds
 */
export function cacheEventData<T>(
  fn: () => Promise<T>,
  eventId?: string
): Promise<T> {
  const tags = eventId
    ? [CACHE_TAGS.events, `${CACHE_TAGS.events}-${eventId}`]
    : [CACHE_TAGS.events];
  return unstable_cache(fn, [`event-data-${eventId || "all"}`], {
    tags,
    revalidate: 60, // 60 seconds
  })();
}

/**
 * Cache finalized results for 5 minutes (less frequently changing)
 */
export function cacheFinalizedResults<T>(
  fn: () => Promise<T>,
  eventId: string
): Promise<T> {
  return unstable_cache(
    fn,
    [`finalized-results-${eventId}`],
    {
      tags: [CACHE_TAGS.finalizedResults, `${CACHE_TAGS.finalizedResults}-${eventId}`],
      revalidate: 300, // 5 minutes
    }
  )();
}

/**
 * Cache photo/video data for 60 seconds
 */
export function cacheMediaData<T>(
  fn: () => Promise<T>,
  key: string
): Promise<T> {
  return unstable_cache(fn, [`media-data-${key}`], {
    tags: [CACHE_TAGS.photos, CACHE_TAGS.videos],
    revalidate: 60, // 60 seconds
  })();
}

