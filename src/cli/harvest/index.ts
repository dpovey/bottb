/**
 * `bottb harvest` - pull the full published history off Facebook, Instagram
 * and YouTube into `posts`.
 *
 * Dry run by default. `--apply` needs `--yes` as well, matching the Brisbane
 * log backfill's contract, because DATABASE_URL is production.
 *
 * Idempotent by construction: every row carries a platform-native
 * `external_id`, and `recordPost` upserts on the unique
 * (platform, external_id) index. Running it twice refreshes the engagement
 * numbers rather than duplicating the history.
 *
 * What it deliberately does not do:
 *   - overwrite a `group_key`, `utm_*` or `notes` written by the Brisbane
 *     2026 log backfill or by hand. Those are facts the platform does not
 *     know, and a harvest that clobbers them is worse than no harvest.
 *   - claim LinkedIn or TikTok. Both are unreachable; they are reported as
 *     gaps in the summary so the number is never mistaken for the whole
 *     history.
 */

import {
  fetchFacebookPosts,
  fetchFacebookVideos,
  fetchInstagramMedia,
  fetchYoutubeVideos,
  metaToken,
  youtubeKey,
} from './fetch'
import {
  planFacebook,
  planInstagram,
  planYoutube,
  type PlanContext,
  type PlannedHarvestPost,
} from './plan'

export type HarvestPlatform = 'facebook' | 'instagram' | 'youtube'
export const HARVEST_PLATFORMS: readonly HarvestPlatform[] = [
  'facebook',
  'instagram',
  'youtube',
] as const

export interface HarvestCounts {
  facebookPosts: number
  facebookVideos: number
  instagramMedia: number
  youtubeVideos: number
}

export interface HarvestPlan {
  posts: PlannedHarvestPost[]
  counts: HarvestCounts
  /** Platforms we cannot reach at all, stated so the total is not misread. */
  gaps: string[]
  warnings: string[]
}

export async function buildHarvestPlan(
  platforms: readonly HarvestPlatform[],
  ctx: PlanContext,
  onProgress: (message: string) => void
): Promise<HarvestPlan> {
  const posts: PlannedHarvestPost[] = []
  const counts: HarvestCounts = {
    facebookPosts: 0,
    facebookVideos: 0,
    instagramMedia: 0,
    youtubeVideos: 0,
  }
  const warnings: string[] = []

  const wantsMeta =
    platforms.includes('facebook') || platforms.includes('instagram')
  const token = wantsMeta ? metaToken() : ''

  if (platforms.includes('facebook')) {
    const fbPosts = await fetchFacebookPosts(token, (page, total) =>
      onProgress(`facebook posts: page ${page}, ${total} so far`)
    )
    const fbVideos = await fetchFacebookVideos(token, (page, total) =>
      onProgress(`facebook videos: page ${page}, ${total} so far`)
    )
    counts.facebookPosts = fbPosts.length
    counts.facebookVideos = fbVideos.length
    const planned = planFacebook(fbPosts, fbVideos, ctx)
    posts.push(...planned)
    const orphans = planned.filter(
      (p) => p.source === 'harvest:facebook-videos'
    ).length
    if (orphans > 0) {
      warnings.push(
        `${orphans} Facebook videos have no matching published_post and were kept as their own rows`
      )
    }
  }

  if (platforms.includes('instagram')) {
    const media = await fetchInstagramMedia(token, (page, total) =>
      onProgress(`instagram media: page ${page}, ${total} so far`)
    )
    counts.instagramMedia = media.length
    posts.push(...planInstagram(media, ctx))
  }

  if (platforms.includes('youtube')) {
    const videos = await fetchYoutubeVideos(youtubeKey(), (page, total) =>
      onProgress(`youtube: page ${page}, ${total} so far`)
    )
    counts.youtubeVideos = videos.length
    posts.push(...planYoutube(videos, ctx))
  }

  posts.sort((a, b) => a.posted_at.localeCompare(b.posted_at))

  const noText = posts.filter((p) => !p.caption?.trim()).length
  if (noText > 0) {
    warnings.push(
      `${noText} posts carry no text at all (image-only posts, and 4 Facebook event creations)`
    )
  }

  return {
    posts,
    counts,
    gaps: [
      'LinkedIn: no API access (r_organization_social is partner-gated). Not harvested.',
      'TikTok (@bottb0): no API access and no credentials. Not harvested.',
      'Reach and impressions: the Meta token has neither read_insights nor instagram_manage_insights.',
    ],
    warnings,
  }
}
