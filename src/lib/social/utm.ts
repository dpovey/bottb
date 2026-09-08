import type { Post, SocialPlatform, UtmMedium } from '../db-types'

/**
 * UTM tagging for social posts.
 *
 * Captions have historically linked to a bare battleofthetechbands.com with
 * no parameters, so every platform lands in one undifferentiated bucket in
 * PostHog. Referrer data alone only tells you the platform, which is useless
 * in an event week when three posts a day come from Instagram.
 *
 * The four parameters:
 *   utm_campaign  the event slug, so it joins straight to events.id
 *   utm_source    the platform
 *   utm_medium    the link PLACEMENT, not just "social"
 *   utm_content   a per-post slug - the one that makes a post attributable
 */

export const DEFAULT_BASE_URL = 'https://battleofthetechbands.com'

/**
 * Instagram captions are not clickable. Traffic from an Instagram post comes
 * through the bio link or a story sticker, and those are different placements
 * with different intent, so they get different mediums.
 */
export function defaultMediumFor(platform: SocialPlatform): UtmMedium {
  return platform === 'instagram' ? 'social_bio' : 'social'
}

export interface UtmParams {
  utm_campaign?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_content?: string | null
}

/**
 * Derive UTMs for a post that does not have them yet.
 *
 * `utm_content` falls back to the group key plus the platform, because a
 * cross-platform burst shares a group but each publication needs its own
 * bucket. If there is no group key there is nothing distinctive to build
 * from, and it stays null rather than becoming a duplicate of somebody else's.
 */
export function deriveUtms(
  post: Pick<Post, 'platform' | 'event_id' | 'group_key'> & UtmParams
): Required<UtmParams> {
  return {
    utm_campaign: post.utm_campaign ?? post.event_id ?? null,
    utm_source: post.utm_source ?? post.platform,
    utm_medium: post.utm_medium ?? defaultMediumFor(post.platform),
    utm_content:
      post.utm_content ??
      (post.group_key ? `${post.group_key}-${post.platform}` : null),
  }
}

/**
 * Build the tagged URL to paste into a caption.
 *
 * Any UTM that is null is left off entirely: a `utm_content=` with no value
 * is worse than no parameter, because it looks like an answer.
 */
export function buildTrackedUrl(
  target: string,
  utms: UtmParams,
  base: string = DEFAULT_BASE_URL
): string {
  const url = new URL(target || base, base)
  for (const key of [
    'utm_campaign',
    'utm_source',
    'utm_medium',
    'utm_content',
  ] as const) {
    const value = utms[key]
    if (value) url.searchParams.set(key, value)
  }
  return url.toString()
}

/** The link for a post row, deriving anything the row does not carry. */
export function trackedUrlForPost(
  post: Pick<Post, 'platform' | 'event_id' | 'group_key'> & UtmParams,
  target: string = DEFAULT_BASE_URL,
  base: string = DEFAULT_BASE_URL
): string {
  return buildTrackedUrl(target, deriveUtms(post), base)
}
