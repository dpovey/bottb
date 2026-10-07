#!/usr/bin/env node
/*
 * Schedule (or publish now) a Facebook Reel on the BotTB page from an ALREADY-UPLOADED Blob URL.
 *
 *   node doc/production/scripts/fb-reel-schedule.mjs <manifest.json> [--dry]
 *
 * MUST be run with the repo root as cwd (reads .env.local there).
 *
 * manifest.json:
 *   { "video_url": "https://...blob...mp4",   // 1080p vertical; never the 4K master
 *     "bytes": 79947884,                      // exact size; checked against the URL before upload
 *     "caption": "...",                       // names only: the API cannot @-tag other Pages
 *     "scheduled_for": "2026-10-02T09:00:00+10:00"   // omit to publish now
 *   }
 *
 * Flow (runbook step 3): video_reels upload_phase=start -> rupload with a file_url header ->
 * poll status until uploading_phase is complete -> upload_phase=finish with
 * video_state=SCHEDULED + scheduled_publish_time. Facebook requires the slot to be more than
 * 10 minutes and less than 29 days ahead. Read copyright_check_status (under `status`) again
 * before the slot: at schedule time it is only "in_progress".
 */
import fs from 'fs'

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]
    })
)
const TOK = env.META_PAGE_ACCESS_TOKEN
const PAGE = env.META_PAGE_ID
const G = 'https://graph.facebook.com/v21.0'

const args = process.argv.slice(2)
const manifestPath = args.find((a) => !a.startsWith('--'))
const DRY = args.includes('--dry')
if (!manifestPath) {
  console.error('usage: fb-reel-schedule.mjs <manifest.json> [--dry]')
  process.exit(2)
}
const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
for (const k of ['video_url', 'bytes', 'caption'])
  if (!m[k]) throw new Error(`manifest needs ${k}`)

let when = null
if (m.scheduled_for) {
  when = Math.floor(new Date(m.scheduled_for).getTime() / 1000)
  const ahead = when - Date.now() / 1000
  if (!(ahead > 600 && ahead < 29 * 86400))
    throw new Error(
      `scheduled_for must be 10 min to 29 days ahead; it is ${Math.round(ahead / 60)} min`
    )
}

// The bytes at the URL must be the bytes we mean to post (a stale Blob passes every other check).
const head = await fetch(m.video_url, { method: 'HEAD' })
const len = Number(head.headers.get('content-length'))
const type = head.headers.get('content-type')
if (!head.ok || len !== m.bytes || type !== 'video/mp4')
  throw new Error(
    `blob check failed: HTTP ${head.status}, ${len} bytes (want ${m.bytes}), ${type}`
  )
console.log(`blob ok: ${len} bytes, ${type}`)
console.log(
  `slot: ${when ? new Date(when * 1000).toISOString() : 'publish now'}`
)
console.log(`caption:\n---\n${m.caption}\n---`)
if (DRY) process.exit(0)

const post = async (url, params, headers = {}) => {
  const r = await fetch(url, {
    method: 'POST',
    headers,
    body: new URLSearchParams(params),
  })
  const j = await r.json()
  if (j.error) throw new Error(`${url}: ${JSON.stringify(j.error)}`)
  return j
}

// Non-vertical files (square promos, 16:9 full songs) go up as a normal page video, not a reel:
// manifest "as_video": true. Same file_url route, so no binary upload from this machine.
if (m.as_video) {
  const v = await post(`${G}/${PAGE}/videos`, {
    file_url: m.video_url,
    description: m.caption,
    ...(when
      ? { published: 'false', scheduled_publish_time: String(when) }
      : {}),
    access_token: TOK,
  })
  const r = await (
    await fetch(
      `${G}/${v.id}?fields=published,scheduled_publish_time,status,permalink_url&access_token=${TOK}`
    )
  ).json()
  console.log(
    JSON.stringify({
      video_id: v.id,
      permalink: `https://www.facebook.com/battleofthetechbands/videos/${v.id}`,
      published: r.published,
      scheduled_publish_time: r.scheduled_publish_time,
      video_status: r.status?.video_status,
    })
  )
  process.exit(0)
}

const start = await post(`${G}/${PAGE}/video_reels`, {
  upload_phase: 'start',
  access_token: TOK,
})
const id = start.video_id
console.log(`video_id ${id}`)
const up = await fetch(
  `https://rupload.facebook.com/video-upload/v21.0/${id}`,
  {
    method: 'POST',
    headers: { Authorization: `OAuth ${TOK}`, file_url: m.video_url },
  }
)
console.log(`rupload: ${JSON.stringify(await up.json())}`)

for (let i = 0; ; i++) {
  const s = await (
    await fetch(`${G}/${id}?fields=status&access_token=${TOK}`)
  ).json()
  const phase = s.status?.uploading_phase?.status
  if (phase === 'complete') break
  if (phase === 'error' || i > 60)
    throw new Error(`upload stuck: ${JSON.stringify(s.status)}`)
  await new Promise((r) => setTimeout(r, 5000))
}

const finish = await post(`${G}/${PAGE}/video_reels`, {
  upload_phase: 'finish',
  video_id: id,
  description: m.caption,
  ...(when
    ? { video_state: 'SCHEDULED', scheduled_publish_time: String(when) }
    : { video_state: 'PUBLISHED' }),
  access_token: TOK,
})
console.log(`finish: ${JSON.stringify(finish)}`)

const v = await (
  await fetch(
    `${G}/${id}?fields=published,scheduled_publish_time,status,permalink_url&access_token=${TOK}`
  )
).json()
console.log(
  JSON.stringify({
    video_id: id,
    permalink: `https://www.facebook.com/reel/${id}`,
    published: v.published,
    scheduled_publish_time: v.scheduled_publish_time,
    video_status: v.status?.video_status,
    copyright: v.status?.copyright_check_status,
  })
)
