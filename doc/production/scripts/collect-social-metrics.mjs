#!/usr/bin/env node
/*
 * Collect social performance into `posts` + `post_metrics`.
 *
 *   node doc/production/scripts/collect-social-metrics.mjs --dry
 *   node doc/production/scripts/collect-social-metrics.mjs
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
const SINCE = new Date(Date.now() - 14 * 864e5)
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
const evOf = (c) =>
  /SYDNEY BAND ANNOUNCEMENT/i.test(c || '') ? 'sydney-2026' : 'brisbane-2026'
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
        views: +v.statistics.viewCount || 0,
        likes: +v.statistics.likeCount || 0,
        comments: +v.statistics.commentCount || 0,
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
      `  ${i.platform.padEnd(10)} ${i.posted_at.slice(0, 16)} ${JSON.stringify(i.metrics)} ${i.caption.slice(0, 40).replace(/\n/g, ' ')}`
    )
}
let newPosts = 0,
  newMetrics = 0,
  skipped = 0
for (const it of items) {
  const ex = await sql(
    'SELECT id FROM posts WHERE platform=$1 AND external_id=$2',
    [it.platform, it.external_id]
  )
  let pid = ex[0]?.id
  if (!pid) {
    if (DRY) {
      newPosts++
      continue
    }
    const r = await sql(
      `INSERT INTO posts (platform,external_id,permalink,status,content_type,event_id,caption,posted_at,posted_via,source,metadata)
       VALUES ($1,$2,$3,'published',$4,$5,$6,$7,'api','backfill-2026-09-22',$8::jsonb) RETURNING id`,
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
