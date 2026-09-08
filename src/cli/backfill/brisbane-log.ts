/**
 * Interpreter for doc/production/brisbane-2026-reel-schedule-log.jsonl.
 *
 * The log is an append-only stream written by a session that was posting at
 * the same time, in whatever shape was convenient at the moment. It is not a
 * schema. Entries overlap, later lines correct earlier ones, and some facts
 * (two LinkedIn reel permalinks) were simply never written down.
 *
 * So this is a pure interpreter over the WHOLE file: it replays every line in
 * order, last write wins, and reports what it could not recover rather than
 * guessing. No database access, no clock, no environment - the same input
 * always produces the same output, which is what makes it testable against
 * the real file.
 *
 * Two rules it will not bend:
 *
 *  - Anything it does not recognise goes in `unhandled`. A log entry must
 *    never vanish silently.
 *  - A time inferred from a schedule is marked `posted_at_estimated`. Only a
 *    time read back from the platform counts as measured. This is the whole
 *    lesson of the 2026-09-08 correction at the end of the file, where a
 *    posting time written from a sense of elapsed time was out by two hours.
 */

import type {
  PostContentType,
  PostStatus,
  PostedVia,
  SocialPlatform,
} from '../../lib/db-types'

const EVENT_ID = 'brisbane-2026'
const TZ = 'Australia/Brisbane'
const OFFSET = '+10:00'
const SOURCE = 'backfill:brisbane-2026-log'

/** A post the backfill proposes to write. Shaped for `recordPost`. */
export interface PlannedPost {
  group_key: string
  platform: SocialPlatform
  external_id: string | null
  permalink: string | null
  status: PostStatus
  content_type: PostContentType | null
  event_id: string
  band_id: string | null
  title: string | null
  collaborators: string[] | null
  media_url: string | null
  scheduled_for: string | null
  posted_at: string | null
  posted_at_estimated: boolean
  posted_tz: string
  posted_via: PostedVia | null
  source: string
  metadata: Record<string, unknown>
  notes: string | null
  /** Log line numbers (1-based) that contributed to this row. */
  lines: number[]
}

export interface BackfillResult {
  posts: PlannedPost[]
  /** Things a human should look at before or after applying. */
  warnings: string[]
  /** Facts the log cannot supply, stated plainly. */
  unrecoverable: string[]
  /** A later line overrode an earlier one. */
  superseded: string[]
  /** Recognised, deliberately not a publication. */
  ignored: string[]
  /** Not recognised at all. Never empty silently. */
  unhandled: string[]
}

// ---------------------------------------------------------------------------
// The six reels, by the log's postKey.
// ---------------------------------------------------------------------------

interface ReelMeta {
  group: string
  band: string | null
  title: string
}

const REELS: Record<string, ReelMeta> = {
  '1': {
    group: 'brisbane-2026-reel-night-highlights',
    band: null,
    title: 'Night highlights',
  },
  '2': {
    group: 'brisbane-2026-reel-shiprex',
    // Not 'shiprex-brisbane-2026'. The band row was created while it was
    // still called "The ShipReX", and band ids are frozen at creation.
    band: 'the-shiprex-brisbane-2026',
    title: 'ShipReX',
  },
  '3': {
    group: 'brisbane-2026-reel-epsonics',
    band: 'epsonics-brisbane-2026',
    title: 'Epsonics',
  },
  '4': {
    group: 'brisbane-2026-reel-jumbo-band',
    band: 'jumbo-band-brisbane-2026',
    title: 'Jumbo Band',
  },
  '5': {
    group: 'brisbane-2026-reel-total-loss',
    band: 'total-loss-brisbane-2026',
    title: 'Total Loss',
  },
  '6': {
    group: 'brisbane-2026-reel-off-the-record',
    band: 'off-the-record-brisbane-2026',
    title: 'Off the Record',
  },
}

const FULLVIDEO = {
  group: 'brisbane-2026-fullvideo-shiprex',
  band: 'the-shiprex-brisbane-2026',
  title: 'ShipReX full set',
}

const THECHAIN = {
  group: 'brisbane-2026-thechain',
  band: 'epsonics-brisbane-2026',
  title: 'Epsonics - The Chain',
}

/** The four Amy Corrie photo posts Facebook was told to publish on its own. */
const PHOTO_GROUPS: Record<string, { group: string; band: string | null }> = {
  'jumbo-band': {
    group: 'brisbane-2026-photos-jumbo-band',
    band: 'jumbo-band-brisbane-2026',
  },
  'total-loss': {
    group: 'brisbane-2026-photos-total-loss',
    band: 'total-loss-brisbane-2026',
  },
  'off-the-record': {
    group: 'brisbane-2026-photos-off-the-record',
    band: 'off-the-record-brisbane-2026',
  },
  audience: { group: 'brisbane-2026-photos-audience', band: null },
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/** "https://x/y at 18:00" or "https://x/y (oEmbed verified)" -> both halves. */
function splitAnnotation(raw: string): { url: string; annotation: string } {
  const m = raw.trim().match(/^(\S+)\s*(.*)$/)
  if (!m) return { url: raw.trim(), annotation: '' }
  return { url: m[1], annotation: m[2].trim() }
}

function isUrl(s: unknown): s is string {
  return typeof s === 'string' && /^https?:\/\//.test(s.trim())
}

/** "scheduled 2026-08-31T16:30+10:00 (link after publish)" -> the instant. */
function parseScheduled(s: string): string | null {
  const m = s.match(
    /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:\d{2})?)/
  )
  return m ? normaliseIso(m[1]) : null
}

/** Give every instant an explicit offset. Brisbane never changes its clocks. */
function normaliseIso(s: string): string {
  let v = s.trim()
  if (/T\d{2}:\d{2}$/.test(v)) v += ':00'
  if (!/[+-]\d{2}:\d{2}$|Z$/.test(v)) v += OFFSET
  // "...T18:00+10:00" -> "...T18:00:00+10:00"
  return v.replace(/T(\d{2}:\d{2})([+-])/, 'T$1:00$2')
}

/** "... at 18:00" combined with a day taken from another field. */
function atTimeOn(day: string, annotation: string): string | null {
  const m = annotation.match(/at (\d{1,2}):(\d{2})/)
  if (!m) return null
  const hh = m[1].padStart(2, '0')
  return `${day}T${hh}:${m[2]}:00${OFFSET}`
}

function dayOf(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null
}

/** The platform's own id, dug out of a permalink. */
export function externalIdFromUrl(
  platform: SocialPlatform,
  url: string
): string | null {
  switch (platform) {
    case 'facebook': {
      const reel = url.match(/\/reel\/(\d+)/)
      if (reel) return reel[1]
      const nested = url.match(/\/(?:videos|posts)\/(\d+)/)
      if (nested) return nested[1]
      return null
    }
    case 'instagram': {
      const m = url.match(/\/(?:reel|p)\/([\w-]+)/)
      return m ? m[1] : null
    }
    case 'youtube': {
      const m = url.match(/(?:shorts\/|youtu\.be\/|v=)([\w-]+)/)
      return m ? m[1] : null
    }
    case 'linkedin': {
      const m = url.match(/urn:li:(?:ugcPost|activity):(\d+)/)
      return m ? m[0] : null
    }
    case 'tiktok': {
      const m = url.match(/\/video\/(\d+)/)
      return m ? m[1] : null
    }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// The interpreter
// ---------------------------------------------------------------------------

interface Ctx {
  posts: Map<string, PlannedPost>
  warnings: string[]
  unrecoverable: string[]
  superseded: string[]
  ignored: string[]
  unhandled: string[]
}

interface Patch {
  externalId?: string | null
  permalink?: string | null
  status?: PostStatus
  contentType?: PostContentType
  band?: string | null
  title?: string
  collaborators?: string[]
  mediaUrl?: string
  scheduledFor?: string | null
  postedAt?: string | null
  postedAtEstimated?: boolean
  postedVia?: PostedVia
  metadata?: Record<string, unknown>
  note?: string
}

function key(group: string, platform: string, externalId: string | null) {
  return `${group}|${platform}|${externalId ?? '~pending'}`
}

/**
 * Merge a fact into the publication it belongs to.
 *
 * Identity is (group, platform, external id). A publication first seen as
 * "scheduled, link after publish" has no id yet, so it lives under a pending
 * key; the first entry that supplies an id adopts that pending row. A
 * *different* id in the same group and platform is a different publication -
 * that is how the Epsonics The Chain group ends up holding both the withdrawn
 * flickery YouTube upload and its replacement.
 */
function merge(
  ctx: Ctx,
  group: string,
  platform: SocialPlatform,
  line: number,
  patch: Patch
): PlannedPost {
  const id = patch.externalId ?? null
  let k = key(group, platform, id)
  let post = ctx.posts.get(k)

  if (!post && id) {
    const pendingKey = key(group, platform, null)
    const pending = ctx.posts.get(pendingKey)
    if (pending) {
      ctx.posts.delete(pendingKey)
      pending.external_id = id
      ctx.posts.set(k, pending)
      post = pending
    }
  }

  if (!post) {
    post = {
      group_key: group,
      platform,
      external_id: id,
      permalink: null,
      status: 'scheduled',
      content_type: null,
      event_id: EVENT_ID,
      band_id: null,
      title: null,
      collaborators: null,
      media_url: null,
      scheduled_for: null,
      posted_at: null,
      posted_at_estimated: false,
      posted_tz: TZ,
      posted_via: null,
      source: SOURCE,
      metadata: {},
      notes: null,
      lines: [],
    }
    k = key(group, platform, id)
    ctx.posts.set(k, post)
  }

  if (!post.lines.includes(line)) post.lines.push(line)

  if (patch.permalink !== undefined && patch.permalink !== null) {
    if (post.permalink && post.permalink !== patch.permalink) {
      ctx.superseded.push(
        `line ${line}: ${group}/${platform} permalink ${post.permalink} -> ${patch.permalink}`
      )
    }
    post.permalink = patch.permalink
  }
  if (patch.externalId !== undefined && patch.externalId !== null) {
    if (post.external_id && post.external_id !== patch.externalId) {
      ctx.superseded.push(
        `line ${line}: ${group}/${platform} external id ${post.external_id} -> ${patch.externalId}`
      )
    }
    post.external_id = patch.externalId
  }
  if (patch.status) post.status = patch.status
  if (patch.contentType) post.content_type = patch.contentType
  if (patch.band !== undefined) post.band_id = patch.band
  if (patch.title) post.title = patch.title
  if (patch.collaborators) post.collaborators = patch.collaborators
  if (patch.mediaUrl) post.media_url = patch.mediaUrl
  if (patch.scheduledFor) post.scheduled_for = patch.scheduledFor
  if (patch.postedAt) {
    const incomingIsMeasured = patch.postedAtEstimated === false
    if (!post.posted_at) {
      post.posted_at = patch.postedAt
      post.posted_at_estimated = !incomingIsMeasured
    } else if (incomingIsMeasured && post.posted_at_estimated) {
      // A time read back from the platform always beats one we inferred.
      if (post.posted_at !== patch.postedAt) {
        ctx.superseded.push(
          `line ${line}: ${group}/${platform} posted_at ${post.posted_at} (estimated) -> ${patch.postedAt} (read back from the platform)`
        )
      }
      post.posted_at = patch.postedAt
      post.posted_at_estimated = false
    }
    // Otherwise: an estimate never overwrites an existing estimate. Log
    // entries are written AFTER the fact, so a later line's own timestamp is
    // further from the truth than the first one that mentioned the post.
  }
  if (patch.postedVia) post.posted_via = patch.postedVia
  if (patch.metadata) post.metadata = { ...post.metadata, ...patch.metadata }
  if (patch.note) {
    post.notes = post.notes ? `${post.notes}\n${patch.note}` : patch.note
  }
  return post
}

/** Mark every already-known publication whose id appears in `text`. */
function withdrawMentioned(
  ctx: Ctx,
  text: string,
  status: PostStatus,
  note: string,
  line: number
): number {
  let hits = 0
  for (const post of ctx.posts.values()) {
    const id = post.external_id
    if (!id) continue
    if (text.includes(id)) {
      post.status = status
      post.notes = post.notes ? `${post.notes}\n${note}` : note
      if (!post.lines.includes(line)) post.lines.push(line)
      hits++
    }
  }
  return hits
}

type Entry = Record<string, unknown>

export function interpretBrisbaneLog(text: string): BackfillResult {
  const ctx: Ctx = {
    posts: new Map(),
    warnings: [],
    unrecoverable: [],
    superseded: [],
    ignored: [],
    unhandled: [],
  }

  const lines = text.split('\n')
  lines.forEach((raw, i) => {
    const lineNo = i + 1
    if (!raw.trim()) return
    let entry: Entry
    try {
      entry = JSON.parse(raw) as Entry
    } catch {
      ctx.unhandled.push(`line ${lineNo}: not valid JSON`)
      return
    }
    handleEntry(ctx, entry, lineNo)
  })

  finalise(ctx)

  const posts = [...ctx.posts.values()].sort(
    (a, b) =>
      (a.group_key < b.group_key ? -1 : a.group_key > b.group_key ? 1 : 0) ||
      (a.platform < b.platform ? -1 : 1)
  )

  return {
    posts,
    warnings: ctx.warnings,
    unrecoverable: ctx.unrecoverable,
    superseded: ctx.superseded,
    ignored: ctx.ignored,
    unhandled: ctx.unhandled,
  }
}

function handleEntry(ctx: Ctx, e: Entry, line: number) {
  if (e.postKey !== undefined) return handleReelEntry(ctx, e, line)
  if (e.correction !== undefined) return handleTikTokCorrection(ctx, e, line)
  if (e.HOLD !== undefined) return handleHold(ctx, e, line)
  if (e.fullvideo_shiprex || e.fullvideo_shiprex_v2)
    return handleFullVideo(ctx, e, line)
  if (e.thechain !== undefined) return handleTheChain(ctx, e, line)
  if (e.note !== undefined && e.ids !== undefined)
    return handleContainerRebuild(ctx, e, line)
  if (e.ts !== undefined && e.action !== undefined)
    return handleTimestamped(ctx, e, line)

  ctx.unhandled.push(`line ${line}: unrecognised entry shape`)
}

// --- the six reels ---------------------------------------------------------

function handleReelEntry(ctx: Ctx, e: Entry, line: number) {
  const pk = String(e.postKey)
  const reel = REELS[pk]
  if (!reel) {
    ctx.unhandled.push(`line ${line}: unknown postKey ${pk}`)
    return
  }
  const { group, band, title } = reel
  const base = { band, title, contentType: 'reel' as PostContentType }

  // Shape A: the build entry. Blob url, Facebook video id, IG container.
  if (e.videoUrl || e.fb_video_id) {
    const when = typeof e.when === 'string' ? normaliseIso(e.when) : null
    const collabs =
      typeof e.collabs === 'string'
        ? e.collabs
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean)
        : undefined

    if (e.fb_video_id) {
      const id = String(e.fb_video_id)
      merge(ctx, group, 'facebook', line, {
        ...base,
        externalId: id,
        permalink:
          typeof e.fb_url === 'string'
            ? e.fb_url
            : `https://www.facebook.com/reel/${id}`,
        status: 'published',
        scheduledFor: when,
        postedAt: when,
        postedAtEstimated: true,
        postedVia: 'native_schedule',
        mediaUrl: typeof e.videoUrl === 'string' ? e.videoUrl : undefined,
      })
    }
    if (e.ig_container) {
      merge(ctx, group, 'instagram', line, {
        ...base,
        status: 'scheduled',
        scheduledFor: when,
        collaborators: collabs,
        postedVia: 'api',
        mediaUrl: typeof e.videoUrl === 'string' ? e.videoUrl : undefined,
        metadata: {
          ig_container: String(e.ig_container),
          ig_container_status: e.ig_status ?? null,
        },
      })
    }
    return
  }

  // Shape B/C/D: per-platform facts, one key per platform.
  const day = dayOf(
    typeof e.facebook_at === 'string'
      ? normaliseIso(e.facebook_at)
      : findGroupDay(ctx, group)
  )

  if (typeof e.youtube === 'string' && e.youtube !== 'pending') {
    const { url, annotation } = splitAnnotation(e.youtube)
    const at =
      (typeof e.youtube_at === 'string' ? normaliseIso(e.youtube_at) : null) ??
      (day ? atTimeOn(day, annotation) : null)
    merge(ctx, group, 'youtube', line, {
      ...base,
      contentType: 'short',
      externalId: externalIdFromUrl('youtube', url),
      permalink: url,
      status: 'published',
      postedAt: at,
      postedAtEstimated: true,
      postedVia: 'browser',
    })
  } else if (e.youtube === 'pending') {
    ctx.ignored.push(`line ${line}: ${group} youtube still pending`)
  }

  if (typeof e.facebook === 'string') {
    const { url, annotation } = splitAnnotation(e.facebook)
    const at = day ? atTimeOn(day, annotation) : null
    merge(ctx, group, 'facebook', line, {
      ...base,
      externalId: externalIdFromUrl('facebook', url),
      permalink: url,
      status: 'published',
      postedAt: at ?? undefined,
      postedAtEstimated: true,
      postedVia: 'native_schedule',
    })
  }

  for (const platform of ['linkedin', 'tiktok'] as const) {
    const v = e[platform]
    if (typeof v !== 'string') continue
    if (isUrl(v)) {
      const { url, annotation } = splitAnnotation(v)
      merge(ctx, group, platform, line, {
        ...base,
        externalId: externalIdFromUrl(platform, url),
        permalink: url,
        status: 'published',
        postedVia: 'browser',
        note: annotation || undefined,
      })
    } else {
      const at = parseScheduled(v)
      merge(ctx, group, platform, line, {
        ...base,
        status: 'published',
        scheduledFor: at,
        postedAt: at,
        postedAtEstimated: true,
        postedVia: 'browser',
      })
    }
  }

  for (const platform of ['linkedin', 'tiktok'] as const) {
    const v = e[`${platform}_live`]
    if (typeof v !== 'string') continue
    const { url, annotation } = splitAnnotation(v)
    merge(ctx, group, platform, line, {
      ...base,
      externalId: externalIdFromUrl(platform, url),
      permalink: url,
      status: 'published',
      postedVia: 'browser',
      note: annotation || undefined,
    })
  }

  if (typeof e.instagram === 'string') {
    const { annotation } = splitAnnotation(e.instagram)
    const container = e.instagram.match(/container (\d+)/)?.[1]
    const cron = e.instagram.match(/cron ([0-9a-f]+)/)?.[1]
    const at = day ? atTimeOn(day, annotation) : null
    merge(ctx, group, 'instagram', line, {
      ...base,
      status: 'scheduled',
      scheduledFor: at,
      postedVia: 'api',
      metadata: {
        ...(container ? { ig_container: container } : {}),
        ...(cron ? { ig_cron: cron } : {}),
      },
    })
  }

  if (e.ig_media_id || e.permalink) {
    const permalink = typeof e.permalink === 'string' ? e.permalink : null
    merge(ctx, group, 'instagram', line, {
      ...base,
      externalId: e.ig_media_id ? String(e.ig_media_id) : null,
      permalink,
      status: 'published',
      postedVia: 'api',
      postedAtEstimated: true,
    })
  }
}

/** The scheduled instant already recorded for any platform in this group. */
function findGroupDay(ctx: Ctx, group: string): string | null {
  for (const post of ctx.posts.values()) {
    if (post.group_key === group && post.scheduled_for)
      return post.scheduled_for
  }
  return null
}

// --- corrections and holds -------------------------------------------------

const TIKTOK_CORRECTION_TARGETS: Record<string, string> = {
  '1_night_highlights': REELS['1'].group,
  '2_shiprex': REELS['2'].group,
  '3_epsonics': REELS['3'].group,
  '4_jumbo': REELS['4'].group,
  '5_total_loss': REELS['5'].group,
  '6_otr_probably': REELS['6'].group,
  fullvideo: FULLVIDEO.group,
}

/**
 * Line 27. Three of the TikTok ids recorded earlier were another post's id.
 * The verified block wins outright: it was checked against each video's own
 * oEmbed caption, which the earlier entries never were.
 */
function handleTikTokCorrection(ctx: Ctx, e: Entry, line: number) {
  const verified = e.tiktok_verified as Record<string, string> | undefined
  if (!verified) {
    ctx.unhandled.push(`line ${line}: correction entry with no tiktok_verified`)
    return
  }
  for (const [logKey, value] of Object.entries(verified)) {
    const group = TIKTOK_CORRECTION_TARGETS[logKey]
    if (!group) {
      ctx.unhandled.push(`line ${line}: unknown correction key ${logKey}`)
      continue
    }
    const { url, annotation } = splitAnnotation(value)
    const id = externalIdFromUrl('tiktok', url)

    // Drop whatever id we had for this group's TikTok post: it was wrong.
    for (const [k, post] of [...ctx.posts.entries()]) {
      if (post.group_key !== group || post.platform !== 'tiktok') continue
      if (post.external_id && post.external_id !== id) {
        ctx.superseded.push(
          `line ${line}: ${group}/tiktok id ${post.external_id} was another post's; corrected to ${id} (verified via oEmbed caption)`
        )
      }
      ctx.posts.delete(k)
      post.external_id = id
      post.permalink = url
      post.status = 'published'
      if (!post.lines.includes(line)) post.lines.push(line)
      if (annotation) {
        post.notes = post.notes ? `${post.notes}\n${annotation}` : annotation
      }
      ctx.posts.set(key(group, 'tiktok', id), post)
      break
    }
    if (![...ctx.posts.values()].some((p) => p.external_id === id)) {
      merge(ctx, group, 'tiktok', line, {
        externalId: id,
        permalink: url,
        status: 'published',
        postedVia: 'browser',
        postedAtEstimated: true,
        note: annotation || undefined,
      })
    }
  }
}

/** Line 32. A QC failure pulled published and scheduled things back. */
function handleHold(ctx: Ctx, e: Entry, line: number) {
  const text = String(e.HOLD)
  const hits = withdrawMentioned(
    ctx,
    text,
    'withdrawn',
    `Withdrawn on hold (line ${line}): ${text}`,
    line
  )
  ctx.warnings.push(
    `line ${line}: HOLD entry withdrew ${hits} publication(s). The Instagram cron was cancelled before any media existed, so there is nothing to withdraw on Instagram.`
  )
}

// --- the ShipReX full video ------------------------------------------------

function handleFullVideo(ctx: Ctx, e: Entry, line: number) {
  const v1 = e.fullvideo_shiprex as Record<string, string> | undefined
  const v2 = e.fullvideo_shiprex_v2 as Record<string, string> | undefined
  const base = {
    band: FULLVIDEO.band,
    title: FULLVIDEO.title,
    contentType: 'video' as PostContentType,
  }
  const platformOf: Record<string, SocialPlatform> = {
    ig: 'instagram',
    instagram: 'instagram',
    fb: 'facebook',
    facebook: 'facebook',
    yt: 'youtube',
    youtube: 'youtube',
    tiktok: 'tiktok',
    linkedin: 'linkedin',
  }

  for (const [obj, isV2] of [
    [v1, false],
    [v2, true],
  ] as const) {
    if (!obj) continue
    for (const [k, value] of Object.entries(obj)) {
      if (k === 'note') {
        // The one deletion the log states in prose rather than by id:
        // the letterboxed and blurred Instagram attempts were removed and
        // replaced by the landscape repost carrying this entry's id.
        if (/deleted/i.test(value)) {
          for (const post of ctx.posts.values()) {
            if (
              post.group_key === FULLVIDEO.group &&
              post.platform === 'instagram' &&
              post.external_id !== externalIdFromUrl('instagram', obj.ig ?? '')
            ) {
              post.status = 'deleted'
              post.notes = `Deleted and replaced by the landscape repost (line ${line}): ${value}`
              ctx.superseded.push(
                `line ${line}: ${FULLVIDEO.group}/instagram ${post.permalink} deleted, replaced by ${obj.ig}`
              )
            }
          }
        }
        continue
      }
      const platform = platformOf[k]
      if (!platform || !isUrl(value)) {
        ctx.unhandled.push(`line ${line}: fullvideo key "${k}" not understood`)
        continue
      }
      const { url, annotation } = splitAnnotation(value)
      merge(ctx, FULLVIDEO.group, platform, line, {
        ...base,
        externalId: externalIdFromUrl(platform, url),
        permalink: url,
        status: 'published',
        postedAtEstimated: true,
        postedVia: platform === 'instagram' ? 'api' : 'browser',
        note:
          annotation ||
          (isV2
            ? 'Landscape repost with videographer collaborators.'
            : undefined),
      })
    }
  }
}

// --- Epsonics, The Chain ---------------------------------------------------

function handleTheChain(ctx: Ctx, e: Entry, line: number) {
  const o = e.thechain as Record<string, string>
  const base = {
    band: THECHAIN.band,
    title: THECHAIN.title,
    contentType: 'video' as PostContentType,
  }

  if (o.fb_scheduled_video_id) {
    merge(ctx, THECHAIN.group, 'facebook', line, {
      ...base,
      externalId: String(o.fb_scheduled_video_id),
      permalink: o.fb_url ?? null,
      status: 'scheduled',
      scheduledFor: o.fb_at ? normaliseIso(o.fb_at) : null,
      postedVia: 'native_schedule',
      mediaUrl: o.blob_1080p,
    })
  }
  if (o.youtube) {
    const at = o.youtube_at ? normaliseIso(o.youtube_at) : null
    merge(ctx, THECHAIN.group, 'youtube', line, {
      ...base,
      externalId: externalIdFromUrl('youtube', o.youtube),
      permalink: o.youtube,
      status: 'published',
      scheduledFor: at,
      postedAt: at,
      postedAtEstimated: true,
      postedVia: 'browser',
      mediaUrl: o.blob_4k,
    })
  }
  if (!o.fb_scheduled_video_id && !o.youtube) {
    ctx.unhandled.push(`line ${line}: thechain entry with no recognised ids`)
  }
}

// --- the IG container rebuild ---------------------------------------------

function handleContainerRebuild(ctx: Ctx, e: Entry, line: number) {
  const ids = e.ids as Record<string, string>
  for (const [pk, container] of Object.entries(ids)) {
    const reel = REELS[pk]
    if (!reel) {
      ctx.unhandled.push(
        `line ${line}: container rebuild for unknown postKey ${pk}`
      )
      continue
    }
    merge(ctx, reel.group, 'instagram', line, {
      metadata: { ig_container: container, ig_container_rebuilt: true },
      note: String(e.note),
    })
  }
  ctx.ignored.push(
    `line ${line}: Instagram container ids are upload handles, not publications. Recorded as metadata on the Instagram rows.`
  )
  if (e.fullvideo_shiprex) handleFullVideo(ctx, e, line)
}

// --- the structured, timestamped entries ----------------------------------

function handleTimestamped(ctx: Ctx, e: Entry, line: number) {
  const action = String(e.action)
  const ts = typeof e.ts === 'string' ? e.ts : null

  switch (action) {
    case 'published_all_platforms':
      return handlePhotoPost(
        ctx,
        e,
        line,
        'brisbane-2026-photos-shiprex',
        FULLVIDEO.band,
        ts
      )
    case 'published_all_four_platforms':
      return handlePhotoPost(
        ctx,
        e,
        line,
        'brisbane-2026-photos-epsonics',
        'epsonics-brisbane-2026',
        ts
      )
    case 'published_youtube_plus_scheduled_social':
    case 'linkedin_and_tiktok_published':
    case 'ALL_PLATFORMS_LIVE':
      return handleTheChainV2(ctx, e, line, action, ts)
    case 'facebook_scheduled_natively':
      return handleNativeSchedule(ctx, e, line)
    case 'correction_to_earlier_entry':
      return handlePostedAtCorrection(ctx, e, line)
    case 'youtube_thumbnail_selected':
    case 'qc_fail_replacement_1080p':
    case 'endcard_4k_v3_installed':
    case 'endcard_v4_installed_new_grade':
      ctx.ignored.push(
        `line ${line}: production/QC step (${action}), not a publication`
      )
      return
    default:
      ctx.unhandled.push(`line ${line}: unknown action "${action}"`)
  }
}

const PHOTO_PLATFORMS: [string, SocialPlatform][] = [
  ['facebook', 'facebook'],
  ['instagram', 'instagram'],
  ['linkedin', 'linkedin'],
  ['tiktok', 'tiktok'],
]

function handlePhotoPost(
  ctx: Ctx,
  e: Entry,
  line: number,
  group: string,
  band: string | null,
  ts: string | null
) {
  const collaborators =
    typeof e.collaborators_ig === 'string'
      ? e.collaborators_ig
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
      : undefined

  for (const [field, platform] of PHOTO_PLATFORMS) {
    const v = e[field]
    if (!isUrl(v)) continue
    merge(ctx, group, platform, line, {
      band,
      title: String(e.item ?? ''),
      contentType: platform === 'tiktok' ? 'video' : 'carousel',
      externalId: externalIdFromUrl(platform, v),
      permalink: v.replace(/\/$/, ''),
      status: 'published',
      // The entry's own timestamp is when it was WRITTEN, not when the post
      // went out. Close, but inferred. Line 43 exists because this gap once
      // cost two hours of accuracy.
      postedAt: ts ? normaliseIso(ts) : null,
      postedAtEstimated: true,
      postedVia: platform === 'instagram' ? 'api' : 'browser',
      collaborators: platform === 'instagram' ? collaborators : undefined,
      note: typeof e.notes === 'string' ? e.notes : undefined,
    })
  }
}

function handleTheChainV2(
  ctx: Ctx,
  e: Entry,
  line: number,
  action: string,
  ts: string | null
) {
  const group = THECHAIN.group
  const base = {
    band: THECHAIN.band,
    title: THECHAIN.title,
    contentType: 'video' as PostContentType,
  }
  const at = ts ? normaliseIso(ts) : null

  for (const [field, platform] of [
    ['youtube', 'youtube'],
    ['facebook', 'facebook'],
    ['instagram', 'instagram'],
    ['linkedin', 'linkedin'],
    ['tiktok', 'tiktok'],
  ] as [string, SocialPlatform][]) {
    const v = e[field]
    if (typeof v !== 'string') continue

    if (/^https?:\/\//.test(v)) {
      // The ALL_PLATFORMS_LIVE entry read both of these back: Facebook
      // published at 18:00 from its native schedule, Instagram at 18:00:19
      // from the session cron. Everything else in that entry is just a link.
      const measuredTimes: Partial<Record<SocialPlatform, string>> = {
        facebook: `2026-09-07T18:00:00${OFFSET}`,
        instagram: `2026-09-07T18:00:19${OFFSET}`,
      }
      const measured =
        action === 'ALL_PLATFORMS_LIVE' ? measuredTimes[platform] : undefined
      merge(ctx, group, platform, line, {
        ...base,
        externalId: externalIdFromUrl(platform, v),
        permalink: v.replace(/\/$/, ''),
        status: 'published',
        postedAt: measured ?? at,
        postedAtEstimated: !measured,
        postedVia:
          platform === 'instagram' || platform === 'facebook'
            ? 'native_schedule'
            : 'browser',
      })
      continue
    }

    // "video id 1390029213265321, scheduled 2026-09-07T18:00+10:00, ..."
    const idMatch = v.match(/video id (\d+)/)
    const scheduled = parseScheduled(v)
    if (idMatch) {
      merge(ctx, group, 'facebook', line, {
        ...base,
        externalId: idMatch[1],
        status: 'scheduled',
        scheduledFor: scheduled,
        postedVia: 'native_schedule',
      })
      continue
    }
    const container = v.match(/container (\d+)/)?.[1]
    if (container) {
      merge(ctx, group, 'instagram', line, {
        ...base,
        status: 'scheduled',
        scheduledFor: `2026-09-07T18:00:00${OFFSET}`,
        postedVia: 'api',
        metadata: { ig_container: container },
      })
      continue
    }
    ctx.ignored.push(`line ${line}: thechain "${field}" is prose, not an id`)
  }
}

function handleNativeSchedule(ctx: Ctx, e: Entry, line: number) {
  const scheduled = e.scheduled as Record<string, string> | undefined
  if (scheduled) {
    for (const [slug, value] of Object.entries(scheduled)) {
      const target = PHOTO_GROUPS[slug]
      if (!target) {
        ctx.unhandled.push(`line ${line}: unknown photo-post slug "${slug}"`)
        continue
      }
      const m = value.match(/^(\S+)\s+@\s+(.*)$/)
      if (!m) {
        ctx.unhandled.push(`line ${line}: cannot parse schedule "${value}"`)
        continue
      }
      const [, fullId, whenText] = m
      merge(ctx, target.group, 'facebook', line, {
        band: target.band,
        title: `Amy Corrie photo post - ${slug}`,
        contentType: 'carousel',
        externalId: fullId.split('_').pop() ?? fullId,
        status: 'scheduled',
        scheduledFor: parseFacebookScheduleText(whenText),
        postedVia: 'native_schedule',
        metadata: { fb_page_post_id: fullId },
        note: 'Scheduled natively on Facebook so it survives a session dying.',
      })
    }
  }

  if (typeof e.deleted === 'string') {
    const idMatch = e.deleted.match(/(\d+_\d+)/)
    if (idMatch) {
      const shortId = idMatch[1].split('_').pop()!
      merge(ctx, THECHAIN.group, 'facebook', line, {
        externalId: shortId,
        status: 'deleted',
        band: THECHAIN.band,
        title: THECHAIN.title,
        contentType: 'video',
        metadata: { fb_page_post_id: idMatch[1] },
        note: `Deleted with Dean's approval: ${e.deleted}`,
      })
    }
  }

  ctx.warnings.push(
    `line ${line}: Instagram has no scheduling API, so the Instagram, LinkedIn and TikTok halves of these four photo posts were left to be posted live each morning. Nothing in the log records whether they were. They are absent from the backfill.`
  )
}

/** "Wed 09 Sep 09:00" -> an instant, using the log's own year. */
function parseFacebookScheduleText(text: string): string | null {
  const m = text.match(/(\d{1,2}) (\w{3}) (\d{1,2}):(\d{2})/)
  if (!m) return null
  const months: Record<string, string> = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12',
  }
  const mm = months[m[2]]
  if (!mm) return null
  return `2026-${mm}-${m[1].padStart(2, '0')}T${m[3].padStart(2, '0')}:${m[4]}:00${OFFSET}`
}

/**
 * Line 43. A prose correction to a posting time.
 *
 * There is no generic way to read a correction written in English, and
 * guessing would reintroduce exactly the error being corrected. So each
 * correction gets an explicit rule, and a correction with no rule is a loud
 * `unhandled` rather than a silent no-op.
 */
function handlePostedAtCorrection(ctx: Ctx, e: Entry, line: number) {
  const corrects = String(e.corrects ?? '')
  if (!corrects.includes('published_all_four_platforms')) {
    ctx.unhandled.push(
      `line ${line}: correction entry has no interpreter rule. Its content has NOT been applied: ${JSON.stringify(e).slice(0, 300)}`
    )
    return
  }

  const group = 'brisbane-2026-photos-epsonics'
  const measured: Record<string, string> = {
    facebook: `2026-09-08T12:19:34${OFFSET}`,
    linkedin: `2026-09-08T12:22:26${OFFSET}`,
  }
  const approx = `2026-09-08T12:20:00${OFFSET}`

  for (const post of ctx.posts.values()) {
    if (post.group_key !== group) continue
    const exact = measured[post.platform]
    ctx.superseded.push(
      `line ${line}: ${group}/${post.platform} posted_at ${post.posted_at} -> ${exact ?? approx}${exact ? ' (read back from the platform)' : ' (still an estimate)'}`
    )
    post.posted_at = exact ?? approx
    post.posted_at_estimated = !exact
    post.notes =
      (post.notes ? `${post.notes}\n` : '') +
      `Time corrected (line ${line}): ${String(e.detail ?? '')}`
    if (!post.lines.includes(line)) post.lines.push(line)
  }
  ctx.warnings.push(
    `line ${line}: the Epsonics photo-post times were corrected from Facebook's created_time and the LinkedIn snowflake id. The Instagram and TikTok times in that group remain estimates around 12:20 AEST.`
  )
}

// ---------------------------------------------------------------------------
// Honesty pass
// ---------------------------------------------------------------------------

function finalise(ctx: Ctx) {
  for (const post of ctx.posts.values()) {
    // A post that was pulled before it went live was never posted. Whatever
    // time we have for it is the time it was DUE.
    if (post.status === 'withdrawn' && post.posted_at_estimated) {
      post.scheduled_for = post.scheduled_for ?? post.posted_at
      post.posted_at = null
    }

    if (post.status === 'published' && !post.permalink) {
      post.notes =
        (post.notes ? `${post.notes}\n` : '') +
        'No permalink was ever recorded. Publication inferred from the schedule, not confirmed.'
      ctx.unrecoverable.push(
        `${post.group_key}/${post.platform}: scheduled for ${post.scheduled_for ?? 'an unrecorded time'} but no permalink was ever written down. The log says it was scheduled and never says what happened. Recorded as published with an estimated time; verify on the platform.`
      )
    }
    if (post.status === 'published' && !post.posted_at) {
      if (post.scheduled_for) {
        post.posted_at = post.scheduled_for
        post.posted_at_estimated = true
      } else {
        // "Published, time unknown" is a real state and the log genuinely
        // does not record one. Inventing a plausible minute here is exactly
        // the mistake the 2026-09-08 correction was written about.
        ctx.unrecoverable.push(
          `${post.group_key}/${post.platform}: published (${post.permalink ?? 'no permalink'}) but the log never records WHEN. posted_at left null; read it back from the platform.`
        )
        post.notes =
          (post.notes ? `${post.notes}\n` : '') +
          'Publish time unknown: the log records the link but never a time.'
      }
    }

    // "Estimated" with nothing to estimate is noise.
    if (!post.posted_at) post.posted_at_estimated = false
  }

  const estimated = [...ctx.posts.values()].filter(
    (p) => p.posted_at && p.posted_at_estimated
  ).length
  ctx.warnings.push(
    `${estimated} of ${ctx.posts.size} posts carry an ESTIMATED posted_at. Instagram publish times in particular come from the cron's scheduled minute, not from the media's own timestamp; re-read them from the Graph API if the metrics workstream needs minute accuracy.`
  )
}
