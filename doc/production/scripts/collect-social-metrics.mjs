#!/usr/bin/env node
/*
 * Collect social performance into `posts` + `post_metrics`.
 *
 *   node doc/production/scripts/collect-social-metrics.mjs --dry
 *   node doc/production/scripts/collect-social-metrics.mjs [--since 2026-09-28]
 *
 * Default window is the last 30 days of posts. Every run adds a new snapshot row per post.
 *
 * MUST run with the repo root as cwd — it reads .env.local from there.
 *
 * Covers YouTube, Instagram and Facebook. LinkedIn and TikTok have no API on
 * our credentials and are NOT collected here; see the runbook table. Anything
 * built on this output is a three-platform view, not an all-platform one.
 *
 * Writes NULL, never 0, where a platform will not answer. See the runbook
 * section "NULL is not zero" — a zero turns "unknown" into "nobody engaged"
 * and silently corrupts every average computed downstream.
 *
 * Idempotent: posts upsert on (platform, external_id); captures are unique on
 * (post_id, captured_at), so a re-run in the same instant will not duplicate.
 */
import fs from 'fs'
const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^"|"$/g, ''),
      ]
    })
)
const TOK = env.META_PAGE_ACCESS_TOKEN,
  PAGE = env.META_PAGE_ID,
  IG = '17841461862790198',
  K = env.YOUTUBE_API_KEY
const G = 'https://graph.facebook.com/v21.0'
const PG = env.POSTGRES_URL,
  HOST = PG.match(/@([^/]+)\//)[1]
const DRY = process.argv.includes('--dry')
const sinceArg = process.argv.indexOf('--since')
const SINCE =
  sinceArg > -1
    ? new Date(process.argv[sinceArg + 1])
    : new Date(Date.now() - 30 * 864e5)
const get = async (u) => (await fetch(u)).json()
const sql = async (query, params = []) => {
  const r = await fetch(`https://${HOST}/sql`, {
    method: 'POST',
    headers: {
      'Neon-Connection-String': PG,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, params }),
  })
  const d = await r.json()
  if (d.message || d.error) throw new Error(JSON.stringify(d).slice(0, 300))
  return d.rows
}
// Only used for posts the ledger does not have yet. Ledger rows carry the event the content shows,
// and Brisbane posts end with "Sydney is next", so the FIRST city named wins, not any mention.
// No city means no guess: NULL, fixed by hand.
const CITY = [
  [/sydney|manning bar|factory theatre/i, 'sydney-2026'],
  [/brisbane|triffid/i, 'brisbane-2026'],
  [/melbourne|howler/i, 'melbourne-2026'],
]
const evOf = (c) => {
  let best = null
  for (const [re, ev] of CITY) {
    const i = (c || '').search(re)
    if (i > -1 && (!best || i < best.i)) best = { i, ev }
  }
  return best?.ev ?? null
}
const CAP = new Date().toISOString()
const items = []

// ---- Facebook: published_posts carry the real PUBLISH time; /videos created_time is UPLOAD time.
const fbPosts = await get(
  `${G}/${PAGE}/published_posts?fields=id,created_time,message,shares,permalink_url,attachments%7Btype,target%7D&limit=50&access_token=${TOK}`
)
const fbVids = await get(
  `${G}/${PAGE}/videos?fields=id,views&limit=50&access_token=${TOK}`
)
const viewsById = Object.fromEntries(
  (fbVids.data || []).map((v) => [v.id, v.views])
)
for (const p of fbPosts.data || []) {
  if (new Date(p.created_time) < SINCE) continue
  const att = (p.attachments?.data || [{}])[0],
    tgt = att.target?.id
  const isVid = /video/.test(att.type || '')
  items.push({
    platform: 'facebook',
    external_id: p.id,
    permalink: p.permalink_url,
    posted_at: p.created_time,
    content_type: isVid ? 'video' : 'photo',
    caption: p.message || '',
    event_id: evOf(p.message),
    metrics: {
      // Graph omits `shares` when a post has none, so absent really is zero here.
      shares: (p.shares || {}).count ?? 0,
      views: isVid && viewsById[tgt] != null ? viewsById[tgt] : null,
      likes: null,
      comments: null,
    },
    raw: { attachment_type: att.type, video_id: tgt || null },
  })
}
// ---- Instagram
const ig = await get(
  `${G}/${IG}/media?fields=id,permalink,timestamp,media_type,like_count,comments_count,caption&limit=50&access_token=${TOK}`
)
for (const m of ig.data || []) {
  if (new Date(m.timestamp) < SINCE) continue
  items.push({
    platform: 'instagram',
    external_id: m.id,
    permalink: m.permalink,
    posted_at: m.timestamp,
    content_type:
      m.media_type === 'VIDEO'
        ? 'reel'
        : m.media_type === 'CAROUSEL_ALBUM'
          ? 'carousel'
          : 'photo',
    caption: m.caption || '',
    event_id: evOf(m.caption),
    metrics: {
      likes: m.like_count ?? null,
      comments: m.comments_count ?? null,
      views: null,
      shares: null,
    },
    raw: { media_type: m.media_type },
  })
}
// ---- YouTube
const ch = await get(
  `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=UCJVbMoGFRdQxVgHvW1heYCg&key=${K}`
)
const pl = await get(
  `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${ch.items[0].contentDetails.relatedPlaylists.uploads}&maxResults=50&key=${K}`
)
const ids = (pl.items || [])
  .filter((i) => new Date(i.contentDetails.videoPublishedAt) >= SINCE)
  .map((i) => i.contentDetails.videoId)
if (ids.length) {
  const st = await get(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,status&id=${ids.join(',')}&key=${K}`
  )
  for (const v of st.items || []) {
    items.push({
      platform: 'youtube',
      external_id: v.id,
      permalink: `https://youtu.be/${v.id}`,
      posted_at: v.snippet.publishedAt,
      content_type: 'video',
      caption: v.snippet.title,
      event_id: evOf(v.snippet.title),
      metrics: {
        // Hidden or disabled counts are absent, not zero.
        views: v.statistics.viewCount != null ? +v.statistics.viewCount : null,
        likes: v.statistics.likeCount != null ? +v.statistics.likeCount : null,
        comments:
          v.statistics.commentCount != null ? +v.statistics.commentCount : null,
        shares: null,
      },
      raw: { privacy: v.status.privacyStatus },
    })
  }
}

console.log(
  `collected ${items.length} posts since ${SINCE.toISOString().slice(0, 10)}`
)
if (DRY) {
  for (const i of items)
    console.log(
      `  ${i.platform.padEnd(10)} ${i.posted_at.slice(0, 16)} ${String(i.event_id).padEnd(14)} ${JSON.stringify(i.metrics)} ${i.caption.slice(0, 40).replace(/\n/g, ' ')}`
    )
}
let newPosts = 0,
  newMetrics = 0,
  skipped = 0
for (const it of items) {
  // The ledger stores whatever id the posting route returned: a FB video id or page-post id, an IG
  // container id or shortcode. Match on any of them, and on the permalink's id, before inserting.
  const ids = [it.external_id, it.raw.video_id].filter(Boolean)
  const token = (it.permalink || '').match(
    /\/(?:p|reel|reels|videos|posts)\/([^/?]+)/
  )?.[1]
  if (token) ids.push(token)
  const likes = ids.map((i) => `%/${i}%`)
  const ex = await sql(
    'SELECT id FROM posts WHERE platform=$1 AND (external_id = ANY($2) OR permalink LIKE ANY($3)) ORDER BY created_at LIMIT 1',
    [it.platform, ids, likes]
  )
  let pid = ex[0]?.id
  if (!pid) {
    if (DRY) {
      console.log(
        `  NEW ${it.platform.padEnd(10)} ${it.posted_at.slice(0, 16)} ${String(it.event_id).padEnd(14)} ${it.caption.slice(0, 50).replace(/\n/g, ' ')}`
      )
      newPosts++
      continue
    }
    const r = await sql(
      `INSERT INTO posts (platform,external_id,permalink,status,content_type,event_id,caption,posted_at,posted_via,source,metadata)
       VALUES ($1,$2,$3,'published',$4,$5,$6,$7,'api','collect-social-metrics',$8::jsonb) RETURNING id`,
      [
        it.platform,
        it.external_id,
        it.permalink,
        it.content_type,
        it.event_id,
        it.caption.slice(0, 4000),
        it.posted_at,
        JSON.stringify(it.raw),
      ]
    )
    pid = r[0].id
    newPosts++
  } else skipped++
  if (DRY) continue
  const m = it.metrics
  await sql(
    `INSERT INTO post_metrics (post_id,captured_at,views,likes,comments,shares,source,raw)
     VALUES ($1,$2::timestamptz,$3::int,$4::int,$5::int,$6::int,'api',$7::jsonb)
     ON CONFLICT (post_id,captured_at) DO NOTHING`,
    [pid, CAP, m.views, m.likes, m.comments, m.shares, JSON.stringify(it.raw)]
  )
  newMetrics++
}
console.log(`posts: ${newPosts} inserted, ${skipped} already present`)
console.log(`post_metrics: ${newMetrics} captures written at ${CAP}`)
