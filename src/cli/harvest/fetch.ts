/**
 * Read-only fetchers for the three platforms that will talk to us.
 *
 * Nothing here writes to a platform. Every call is a GET, and the only
 * credentials used are the ones already in `.env.local`:
 * `META_PAGE_ACCESS_TOKEN` and `YOUTUBE_API_KEY`.
 *
 * What is deliberately NOT here, and why (see
 * doc/production/social-history-and-metrics-feasibility.md for the proof):
 *
 *   - Insights. The Meta page token carries no `read_insights` and no
 *     `instagram_manage_insights`, so reach and impressions 403. Asking for
 *     them costs a round trip and returns an error, so we do not ask.
 *   - `likes.summary` / `comments.summary` on Facebook posts. Refused by the
 *     same token even though `pages_read_engagement` is listed, most likely
 *     because the app has not passed App Review. Requesting the field makes
 *     the WHOLE page of posts fail, not just that field, so it must stay out
 *     of the field list.
 *   - LinkedIn and TikTok. No API access at all. They are gaps, and the
 *     harvest reports them as gaps rather than pretending otherwise.
 *
 * Pagination is sequential with a small delay between pages. The whole
 * history is about eight requests; there is no reason to be fast about it.
 */

const GRAPH_VERSION = 'v21.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`
const YT_BASE = 'https://www.googleapis.com/youtube/v3'

export const FACEBOOK_PAGE_ID = '207312765803305'
export const INSTAGRAM_USER_ID = '17841461862790198'
export const YOUTUBE_CHANNEL_ID = 'UCJVbMoGFRdQxVgHvW1heYCg'

/** Politeness delay between paged requests, in milliseconds. */
const PAGE_DELAY_MS = 350
/** Hard stop, so a cursor bug cannot loop forever against a live API. */
const MAX_PAGES = 40

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class HarvestFetchError extends Error {
  constructor(
    readonly platform: string,
    readonly url: string,
    message: string
  ) {
    super(message)
  }
}

/** Strip the token out of anything we might print or store. */
function redact(url: string): string {
  return url.replace(/(access_token|key)=[^&]*/g, '$1=REDACTED')
}

/**
 * Meta answers a page that is too expensive to assemble with a 500 and
 * "Please reduce the amount of data you're asking for" - not a 4xx, and not
 * a rate limit. `limit=100` with the attachments sub-edge triggers it
 * reliably on this page. Retrying the same request is useless; the fix is a
 * smaller page, which the caller handles by halving `limit`. It is also worth
 * a real retry for a genuine transient (429, 5xx without that message).
 */
function isPageTooBig(status: number, body: string): boolean {
  return status >= 500 && /reduce the amount of data/i.test(body)
}

async function getJson<T>(
  platform: string,
  url: string,
  attempt = 1
): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  const text = await res.text()
  if (!res.ok) {
    const retryable =
      !isPageTooBig(res.status, text) &&
      (res.status === 429 || res.status >= 500)
    if (retryable && attempt < 3) {
      await sleep(1000 * attempt)
      return getJson<T>(platform, url, attempt + 1)
    }
    throw new HarvestFetchError(
      platform,
      redact(url),
      `HTTP ${res.status}: ${text.slice(0, 400)}`
    )
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new HarvestFetchError(
      platform,
      redact(url),
      `response was not JSON: ${text.slice(0, 200)}`
    )
  }
}

interface GraphPage<T> {
  data: T[]
  paging?: { cursors?: { after?: string }; next?: string }
}

/**
 * Walk a Graph API edge to the end, following `paging.next` verbatim.
 *
 * Following the URL Meta hands back, rather than rebuilding it from a cursor,
 * is the difference between a loop that terminates and one that quietly
 * re-reads page one.
 */
async function graphAll<T>(
  platform: string,
  build: (limit: number) => string,
  onPage?: (n: number, total: number) => void
): Promise<T[]> {
  let limit = 50
  for (;;) {
    try {
      const items: T[] = []
      let url: string | undefined = build(limit)
      for (let page = 1; url && page <= MAX_PAGES; page++) {
        const body: GraphPage<T> = await getJson<GraphPage<T>>(platform, url)
        items.push(...(body.data ?? []))
        onPage?.(page, items.length)
        url = body.paging?.next
        if (url) await sleep(PAGE_DELAY_MS)
      }
      return items
    } catch (err) {
      const tooBig =
        err instanceof HarvestFetchError &&
        /reduce the amount of data/i.test(err.message)
      if (!tooBig || limit <= 5) throw err
      limit = Math.max(5, Math.floor(limit / 2))
      await sleep(PAGE_DELAY_MS)
    }
  }
}

// ---------------------------------------------------------------------------
// Facebook
// ---------------------------------------------------------------------------

export interface FbPost {
  id: string
  created_time: string
  /**
   * When the post was last changed. Facebook returns this even for posts we
   * never touched (it moves when a comment lands), but a gap of hours or days
   * against `created_time` on a post is a strong signal that the caption was
   * EDITED after publication - which is a record of what somebody thought was
   * wrong enough to fix by hand.
   */
  updated_time?: string
  message?: string
  permalink_url?: string
  status_type?: string
  shares?: { count: number }
  is_published?: boolean
  full_picture?: string
  attachments?: {
    data: { media_type?: string; type?: string; title?: string; url?: string }[]
  }
}

export interface FbVideo {
  id: string
  created_time: string
  title?: string
  description?: string
  permalink_url?: string
  length?: number
  views?: number
}

const FB_POST_FIELDS = [
  'id',
  'created_time',
  'updated_time',
  'message',
  'permalink_url',
  'status_type',
  'shares',
  'is_published',
  'full_picture',
  'attachments{media_type,type,title,url}',
].join(',')

const FB_VIDEO_FIELDS = [
  'id',
  'created_time',
  'title',
  'description',
  'permalink_url',
  'length',
  'views',
].join(',')

export function metaToken(): string {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token) {
    throw new HarvestFetchError(
      'meta',
      '',
      'META_PAGE_ACCESS_TOKEN is not set; Facebook and Instagram cannot be harvested'
    )
  }
  return token
}

export async function fetchFacebookPosts(
  token: string,
  onPage?: (n: number, total: number) => void
): Promise<FbPost[]> {
  return graphAll<FbPost>(
    'facebook',
    (limit) =>
      `${GRAPH_BASE}/${FACEBOOK_PAGE_ID}/published_posts` +
      `?fields=${encodeURIComponent(FB_POST_FIELDS)}&limit=${limit}&access_token=${token}`,
    onPage
  )
}

export async function fetchFacebookVideos(
  token: string,
  onPage?: (n: number, total: number) => void
): Promise<FbVideo[]> {
  return graphAll<FbVideo>(
    'facebook',
    (limit) =>
      `${GRAPH_BASE}/${FACEBOOK_PAGE_ID}/videos` +
      `?fields=${encodeURIComponent(FB_VIDEO_FIELDS)}&limit=${limit}&access_token=${token}`,
    onPage
  )
}

// ---------------------------------------------------------------------------
// Instagram
// ---------------------------------------------------------------------------

export interface IgMedia {
  id: string
  timestamp: string
  media_type?: string
  media_product_type?: string
  permalink?: string
  caption?: string
  like_count?: number
  comments_count?: number
  media_url?: string
  thumbnail_url?: string
}

const IG_FIELDS = [
  'id',
  'timestamp',
  'media_type',
  'media_product_type',
  'permalink',
  'caption',
  'like_count',
  'comments_count',
  'thumbnail_url',
].join(',')

export async function fetchInstagramMedia(
  token: string,
  onPage?: (n: number, total: number) => void
): Promise<IgMedia[]> {
  return graphAll<IgMedia>(
    'instagram',
    (limit) =>
      `${GRAPH_BASE}/${INSTAGRAM_USER_ID}/media` +
      `?fields=${encodeURIComponent(IG_FIELDS)}&limit=${limit}&access_token=${token}`,
    onPage
  )
}

// ---------------------------------------------------------------------------
// YouTube
// ---------------------------------------------------------------------------

export interface YtVideo {
  id: string
  publishedAt: string
  title: string
  description: string
  duration?: string
  viewCount?: number
  likeCount?: number
  commentCount?: number
}

interface YtPlaylistItem {
  snippet: {
    publishedAt: string
    title: string
    description: string
    resourceId: { videoId: string }
  }
  contentDetails: { videoId: string; videoPublishedAt?: string }
}

export function youtubeKey(): string {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) {
    throw new HarvestFetchError(
      'youtube',
      '',
      'YOUTUBE_API_KEY is not set; YouTube cannot be harvested'
    )
  }
  return key
}

export async function fetchYoutubeVideos(
  key: string,
  onPage?: (n: number, total: number) => void
): Promise<YtVideo[]> {
  const channel = await getJson<{
    items: { contentDetails: { relatedPlaylists: { uploads: string } } }[]
  }>(
    'youtube',
    `${YT_BASE}/channels?part=contentDetails&id=${YOUTUBE_CHANNEL_ID}&key=${key}`
  )
  const uploads = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploads) {
    throw new HarvestFetchError(
      'youtube',
      '',
      `channel ${YOUTUBE_CHANNEL_ID} returned no uploads playlist`
    )
  }

  const items: YtPlaylistItem[] = []
  let pageToken: string | undefined
  for (let page = 1; page <= MAX_PAGES; page++) {
    const body: {
      items: YtPlaylistItem[]
      nextPageToken?: string
    } = await getJson(
      'youtube',
      `${YT_BASE}/playlistItems?part=snippet,contentDetails&playlistId=${uploads}` +
        `&maxResults=50&key=${key}${pageToken ? `&pageToken=${pageToken}` : ''}`
    )
    items.push(...(body.items ?? []))
    onPage?.(page, items.length)
    pageToken = body.nextPageToken
    if (!pageToken) break
    await sleep(PAGE_DELAY_MS)
  }

  // videos.list takes 50 ids per call, so the whole channel's statistics cost
  // two quota units. Batch rather than looping per video.
  const stats = new Map<
    string,
    { duration?: string; views?: number; likes?: number; comments?: number }
  >()
  const ids = items.map((i) => i.contentDetails.videoId)
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const body: {
      items: {
        id: string
        contentDetails?: { duration?: string }
        statistics?: {
          viewCount?: string
          likeCount?: string
          commentCount?: string
        }
      }[]
    } = await getJson(
      'youtube',
      `${YT_BASE}/videos?part=statistics,contentDetails&id=${chunk.join(',')}&key=${key}`
    )
    for (const v of body.items ?? []) {
      stats.set(v.id, {
        duration: v.contentDetails?.duration,
        views: v.statistics?.viewCount
          ? Number(v.statistics.viewCount)
          : undefined,
        likes: v.statistics?.likeCount
          ? Number(v.statistics.likeCount)
          : undefined,
        comments: v.statistics?.commentCount
          ? Number(v.statistics.commentCount)
          : undefined,
      })
    }
    if (i + 50 < ids.length) await sleep(PAGE_DELAY_MS)
  }

  return items.map((i) => {
    const s = stats.get(i.contentDetails.videoId) ?? {}
    return {
      id: i.contentDetails.videoId,
      // The playlist item's own publishedAt is when it was added to the
      // uploads playlist. contentDetails.videoPublishedAt is when the video
      // went public, which is the fact we want.
      publishedAt: i.contentDetails.videoPublishedAt ?? i.snippet.publishedAt,
      title: i.snippet.title,
      description: i.snippet.description,
      duration: s.duration,
      viewCount: s.views,
      likeCount: s.likes,
      commentCount: s.comments,
    }
  })
}
