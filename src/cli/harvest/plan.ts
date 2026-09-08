/**
 * Turning what the platforms returned into rows for `posts`.
 *
 * Pure: raw records in, planned rows out. The fetching lives in `fetch.ts`
 * and the database work in the CLI, so this file can be tested against a
 * captured API response without a token or a connection.
 *
 * Two decisions worth stating, because both could reasonably have gone the
 * other way:
 *
 *  - **One row per publication, not one per API record.** Facebook's
 *    `/videos` edge overlaps `/published_posts`: the same reel appears on
 *    both, under different ids. The videos edge is the only place a view
 *    count lives, so it cannot simply be dropped. A video that matches a
 *    post is folded into that post's metadata; a video with no matching post
 *    becomes its own row. Emitting both would double every video post in
 *    every per-event count.
 *
 *  - **`posted_at_estimated` is false for everything here.** Every timestamp
 *    is read back from the platform that published it. That is the
 *    distinction the column exists for, and it is why a harvested time should
 *    win over the Brisbane log's inferred one.
 */

import type {
  PostContentType,
  PostStatus,
  PostedVia,
  SocialPlatform,
} from '../../lib/db-types'
import type { FbPost, FbVideo, IgMedia, YtVideo } from './fetch'
import {
  matchPost,
  type BandRef,
  type CompanyRef,
  type EventRef,
  type MatchConfidence,
} from './match'

export interface PlannedHarvestPost {
  platform: SocialPlatform
  external_id: string
  permalink: string | null
  status: PostStatus
  content_type: PostContentType | null
  event_id: string | null
  band_id: string | null
  title: string | null
  caption: string | null
  media_url: string | null
  posted_at: string
  posted_at_estimated: false
  posted_tz: string
  posted_via: PostedVia | null
  source: string
  metadata: Record<string, unknown>
  /** Not written; shown in the dry run so a human can audit the match. */
  match: {
    eventConfidence: MatchConfidence
    bandConfidence: MatchConfidence
    reasons: string[]
  }
}

/**
 * Every harvested post is a live thing on a platform, so `published`, and
 * everything on this page went out through the Graph API, a browser or a
 * human. We cannot tell which from the API, so `posted_via` stays null
 * rather than asserting 'api' for posts that were dragged in by hand.
 */
const STATUS: PostStatus = 'published'

/**
 * All three platforms return UTC. The event timezone is a property of the
 * event, not of the harvest, so recording UTC here and letting a reader
 * convert is the honest option.
 */
const TZ = 'UTC'

function fbContentType(p: FbPost): PostContentType | null {
  switch (p.status_type) {
    case 'added_video':
      return 'video'
    case 'added_photos':
      return (p.attachments?.data?.length ?? 0) > 1 ? 'carousel' : 'photo'
    case 'mobile_status_update':
      return 'text'
    case 'created_event':
      return 'link'
    default:
      return null
  }
}

function igContentType(m: IgMedia): PostContentType | null {
  if (m.media_product_type === 'REELS') return 'reel'
  if (m.media_type === 'CAROUSEL_ALBUM') return 'carousel'
  if (m.media_type === 'VIDEO') return 'video'
  if (m.media_type === 'IMAGE') return 'photo'
  return null
}

/** `@handle` and `@Page Name` mentions, as written in the caption. */
export function extractMentions(text: string | null | undefined): string[] {
  if (!text) return []
  const found = text.match(/@[A-Za-z0-9._][A-Za-z0-9._]{1,29}/g) ?? []
  return [...new Set(found.map((m) => m.slice(1).replace(/[._]+$/, '')))]
}

export interface PlanContext {
  events: EventRef[]
  bands: BandRef[]
  companies: CompanyRef[]
}

function planOne(
  base: Omit<PlannedHarvestPost, 'event_id' | 'band_id' | 'match'>,
  text: string,
  ctx: PlanContext
): PlannedHarvestPost {
  const m = matchPost(
    { text, postedAt: base.posted_at },
    ctx.events,
    ctx.bands,
    ctx.companies
  )
  return {
    ...base,
    event_id: m.eventId,
    band_id: m.bandId,
    match: {
      eventConfidence: m.eventConfidence,
      bandConfidence: m.bandConfidence,
      reasons: m.reasons,
    },
  }
}

/**
 * Facebook posts, with the `/videos` edge folded in.
 *
 * The join is by timestamp and text rather than by id, because Meta gives a
 * video and the post that carries it different ids and offers no field
 * linking them on either edge. Both are written by the same publish action,
 * so they share a `created_time` to within a couple of seconds.
 */
export function planFacebook(
  posts: FbPost[],
  videos: FbVideo[],
  ctx: PlanContext
): PlannedHarvestPost[] {
  const unusedVideos = new Set(videos)

  // Text first, time second. `created_time` on the videos edge is when the
  // file was UPLOADED, not when the post went live, and for a scheduled reel
  // those are days apart - so a timestamp window alone misses most of them.
  // An exact caption match is far stronger evidence, and where the caption is
  // empty on either side the timestamp is all there is, so the window
  // tightens right down.
  const videoFor = (p: FbPost): FbVideo | undefined => {
    if (p.status_type !== 'added_video') return undefined
    const t = Date.parse(p.created_time)
    const message = (p.message ?? '').trim()
    let best: FbVideo | undefined
    let bestGap = Infinity
    for (const v of unusedVideos) {
      const description = (v.description ?? '').trim()
      const gap = Math.abs(Date.parse(v.created_time) - t)
      const identical = message.length > 0 && message === description
      // 14 days for an exact caption match, two minutes without one.
      if (gap > (identical ? 14 * 86_400_000 : 120_000)) continue
      if (!identical && message.length > 0 && description.length > 0) continue
      if (gap < bestGap) {
        best = v
        bestGap = gap
      }
    }
    if (best) unusedVideos.delete(best)
    return best
  }

  const rows: PlannedHarvestPost[] = []
  for (const p of posts) {
    const video = videoFor(p)
    const text = p.message ?? ''
    rows.push(
      planOne(
        {
          platform: 'facebook',
          external_id: p.id,
          permalink: p.permalink_url ?? null,
          status: STATUS,
          content_type: fbContentType(p),
          title: video?.title ?? null,
          caption: p.message ?? null,
          media_url: p.full_picture ?? null,
          posted_at: p.created_time,
          posted_at_estimated: false,
          posted_tz: TZ,
          posted_via: null,
          source: 'harvest:facebook',
          metadata: {
            status_type: p.status_type ?? null,
            shares: p.shares?.count ?? 0,
            updated_time: p.updated_time ?? null,
            // More than two minutes apart means somebody went back in. Worth
            // keeping: an edited post says what was considered wrong.
            edited_after_publish: p.updated_time
              ? Math.abs(
                  Date.parse(p.updated_time) - Date.parse(p.created_time)
                ) > 120_000
              : false,
            attachments:
              p.attachments?.data?.map((a) => ({
                media_type: a.media_type ?? null,
                type: a.type ?? null,
              })) ?? [],
            ...(video
              ? {
                  fb_video_id: video.id,
                  views: video.views ?? null,
                  length_seconds: video.length ?? null,
                }
              : {}),
          },
        },
        text,
        ctx
      )
    )
  }

  // Videos with no published_post of their own. These are real publications
  // (some reels never appear on the posts edge), so they get their own row
  // keyed on the video id, which cannot collide with a post id.
  for (const v of unusedVideos) {
    const text = [v.title, v.description].filter(Boolean).join('\n')
    rows.push(
      planOne(
        {
          platform: 'facebook',
          external_id: v.id,
          permalink: v.permalink_url
            ? `https://www.facebook.com${v.permalink_url}`
            : null,
          status: STATUS,
          content_type: 'video',
          title: v.title ?? null,
          caption: v.description ?? null,
          media_url: null,
          posted_at: v.created_time,
          posted_at_estimated: false,
          posted_tz: TZ,
          posted_via: null,
          source: 'harvest:facebook-videos',
          metadata: {
            views: v.views ?? null,
            length_seconds: v.length ?? null,
            note: 'video edge only; no matching published_post',
          },
        },
        text,
        ctx
      )
    )
  }

  return rows
}

export function planInstagram(
  media: IgMedia[],
  ctx: PlanContext
): PlannedHarvestPost[] {
  return media.map((m) =>
    planOne(
      {
        platform: 'instagram',
        external_id: m.id,
        permalink: m.permalink ?? null,
        status: STATUS,
        content_type: igContentType(m),
        title: null,
        caption: m.caption ?? null,
        media_url: m.thumbnail_url ?? null,
        posted_at: m.timestamp,
        posted_at_estimated: false,
        posted_tz: TZ,
        posted_via: null,
        source: 'harvest:instagram',
        metadata: {
          media_type: m.media_type ?? null,
          media_product_type: m.media_product_type ?? null,
          like_count: m.like_count ?? null,
          comments_count: m.comments_count ?? null,
          mentions: extractMentions(m.caption),
        },
      },
      m.caption ?? '',
      ctx
    )
  )
}

export function planYoutube(
  videos: YtVideo[],
  ctx: PlanContext
): PlannedHarvestPost[] {
  return videos.map((v) =>
    planOne(
      {
        platform: 'youtube',
        external_id: v.id,
        permalink: `https://youtu.be/${v.id}`,
        status: STATUS,
        content_type: 'video',
        title: v.title,
        // The description is the post text on YouTube. Storing it in
        // `caption` keeps one column answering "what did we say", across
        // platforms that each name it differently.
        caption: v.description || null,
        media_url: null,
        posted_at: v.publishedAt,
        posted_at_estimated: false,
        posted_tz: TZ,
        posted_via: null,
        source: 'harvest:youtube',
        metadata: {
          duration: v.duration ?? null,
          view_count: v.viewCount ?? null,
          like_count: v.likeCount ?? null,
          comment_count: v.commentCount ?? null,
        },
      },
      `${v.title}\n${v.description}`,
      ctx
    )
  )
}
