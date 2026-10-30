#!/usr/bin/env node
/**
 * One video post, end to end, from a single post.json: Blob uploads, the Facebook and Instagram
 * publishes, the ledger rows for every platform, the website `videos` row and the WhatsApp text.
 * YouTube, LinkedIn and TikTok are still posted in Chrome; this records them afterwards.
 *
 *   node doc/production/scripts/publish-video.mjs <post.json> <command> [args] [--dry]
 *
 *   check                 read-only: files, sizes, captions, title, what is done so far (default)
 *   upload                Blob-upload the IG file, the master and the IG cover (skips ones already up)
 *   fb [--dry]            Facebook reel from the IG file (or `facebook.as_video`), now or `scheduled_for`
 *   ig [--dry]            Instagram reel, published now (IG has no scheduling API)
 *   record <platform> [id] [--dry]
 *                         ledger row; facebook/instagram take their ids from the results above;
 *                         youtube <id> also inserts the website `videos` row once the video is public;
 *                         tiktok <id> and linkedin <activity-urn> take their time from the id itself
 *   whatsapp              the plain-text summary for Dean to paste
 *
 * MUST be run from the repo root (reads .env.local, runs the sibling scripts and `pnpm bottb`).
 * Built 30 Oct 2026 after the V2 Voyagers post took ~15 hand-run steps, two of which tripped on zsh
 * not word-splitting a shared options variable. Children are spawned with argument arrays, no shell.
 *
 * post.json (results are written back into it, so it doubles as the post's state):
 *   { "group": "sydney-2026-v2-voyagers-starships-ufo", "event": "sydney-2026",
 *     "band": "v2-voyagers-sydney-2026",
 *     "title": "<the YouTube title, also the ledger title>",
 *     "copy": "doc/production/v2-voyagers-starships-ufo-copy.md",   // captions = first ``` block
 *                                                                   // under "## Facebook" etc.
 *     "files": { "ig": "<1080p_IG mp4, <= 300 MB>", "master": "<4K mp4 for YouTube>",
 *                "ig_cover": "<1080x1920 jpg>" },
 *     "blob_prefix": "release/sydney-2026/",
 *     "collaborators": ["sailornicole", "demonrace", "youngcareoz"],
 *     "facebook": { "scheduled_for": "2026-11-01T09:00:00+11:00" }  // optional; omit to post now
 *   }
 */
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf('=')
      return [
        l.slice(0, i),
        l
          .slice(i + 1)
          .trim()
          .replace(/^"|"$/g, ''),
      ]
    })
)
const G = 'https://graph.facebook.com/v21.0'
const SCRIPTS = 'doc/production/scripts'
const IG_CAP = 300e6

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry')
const [postPath, cmd = 'check', ...rest] = argv.filter((a) => a !== '--dry')
if (!postPath) {
  console.error(
    'usage: publish-video.mjs <post.json> <check|upload|fb|ig|record|whatsapp> [args] [--dry]'
  )
  process.exit(2)
}
const post = JSON.parse(fs.readFileSync(postPath, 'utf8'))
post.results ??= {}
const save = () =>
  fs.writeFileSync(postPath, JSON.stringify(post, null, 2) + '\n')
const die = (msg) => {
  console.error(`ERROR: ${msg}`)
  process.exit(1)
}
for (const k of ['group', 'event', 'band', 'title', 'copy'])
  if (!post[k]) die(`post.json needs ${k}`)

/* The copy doc is the one place captions live; manifests are generated from it so an edit there
 * cannot drift from what posts. A heading matches by prefix ("## Facebook (reel, 1080p IG file)"). */
function caption(platform, { draft = false } = {}) {
  const lines = fs.readFileSync(post.copy, 'utf8').split('\n')
  const h = lines.findIndex((l) => l.startsWith(`## ${platform}`))
  if (h < 0) die(`no "## ${platform}" section in ${post.copy}`)
  const next = lines.findIndex((l, i) => i > h && l.startsWith('## '))
  const section = lines.slice(h + 1, next < 0 ? undefined : next).join('\n')
  const m = section.match(/```\n([\s\S]*?)\n```/)
  if (!m) die(`no fenced caption under "## ${platform}" in ${post.copy}`)
  let c = m[1]
  if (c.includes('<youtube link>') && !draft) {
    if (!post.results.youtube)
      die(`${platform} caption needs the YouTube link; record youtube first`)
    c = c.replace('<youtube link>', post.results.youtube.permalink)
  }
  return c
}

/* Voice and platform rules that have each cost a post once (runbook "Copy process"). */
function lintCaption(platform, c) {
  const issues = []
  if (c.includes('—')) issues.push('em dash')
  if (/house band/i.test(c)) issues.push('"house band"')
  if (platform === 'Instagram' && /@[\w.]+\.(\s|$)/.test(c))
    issues.push('full stop straight after an @handle')
  return issues
}

function run(args, { capture = true } = {}) {
  const r = spawnSync(args[0], args.slice(1), {
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (capture) process.stdout.write(r.stdout + r.stderr)
  if (r.status !== 0) die(`${args.slice(0, 3).join(' ')} exited ${r.status}`)
  return r.stdout ?? ''
}

const blobUrl = (key) => (post.results.blob ?? {})[key]?.url
const head = async (url) => {
  const r = await fetch(url, { method: 'HEAD' })
  return {
    ok: r.ok,
    bytes: Number(r.headers.get('content-length')),
    type: r.headers.get('content-type'),
  }
}
const sql = async (query, params = []) => {
  const cs = env.POSTGRES_URL
  const r = await fetch(`https://${new URL(cs).hostname}/sql`, {
    method: 'POST',
    headers: {
      'Neon-Connection-String': cs,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, params }),
  })
  const j = await r.json()
  if (!j.rows) die(`sql: ${JSON.stringify(j)}`)
  return j.rows
}

async function check() {
  let bad = 0
  console.log(`title (${post.title.length}/100): ${post.title}`)
  if (post.title.length > 100)
    (bad++, console.log('  over the 100-char YouTube cap'))
  for (const [k, f] of Object.entries(post.files ?? {})) {
    if (!fs.existsSync(f)) (bad++, console.log(`  ${k}: MISSING ${f}`))
    else {
      const b = fs.statSync(f).size
      const over = k === 'ig' && b > IG_CAP
      if (over) bad++
      console.log(
        `  ${k}: ${b.toLocaleString()} bytes = ${(b / 1e6).toFixed(1)} MB${over ? '  OVER the 300 MB IG cap' : ''}`
      )
    }
  }
  for (const p of ['YouTube', 'Facebook', 'Instagram', 'LinkedIn', 'TikTok']) {
    const md = fs.readFileSync(post.copy, 'utf8')
    if (!md.split('\n').some((l) => l.startsWith(`## ${p}`))) {
      console.log(`  ${p}: no copy section`)
      continue
    }
    const c = caption(p, { draft: true })
    const issues = lintCaption(p, c)
    if (issues.length) bad++
    console.log(
      `  ${p}: ${c.length} chars${issues.length ? '  ' + issues.join(', ') : ''}`
    )
  }
  console.log('done so far:', Object.keys(post.results).join(', ') || 'nothing')
  if (bad) die(`${bad} problem(s) above`)
}

async function upload() {
  post.results.blob ??= {}
  for (const key of ['ig', 'master', 'ig_cover']) {
    const f = post.files?.[key]
    if (!f) continue
    const size = fs.statSync(f).size
    const prev = post.results.blob[key]
    if (prev && (await head(prev.url)).bytes === size) {
      console.log(`${key}: already up, ${size} bytes`)
      continue
    }
    if (key === 'ig' && size > IG_CAP)
      die(`IG file is ${(size / 1e6).toFixed(1)} MB, over the 300 MB cap`)
    const dest = `${post.blob_prefix ?? `release/${post.event}/`}${path.basename(f)}`
    if (DRY) {
      console.log(`would upload ${f} -> ${dest}`)
      continue
    }
    const out = run(['node', `${SCRIPTS}/blob-upload.mjs`, f, dest])
    const url = out.match(/^BLOB_URL (\S+)/m)?.[1]
    if (!url) die(`no BLOB_URL from blob-upload for ${key}`)
    const h = await head(url)
    if (h.bytes !== size) die(`${key}: remote ${h.bytes} bytes, local ${size}`)
    post.results.blob[key] = { url, bytes: size }
    save()
  }
}

function manifest(kind, body) {
  const p = path.join(
    path.dirname(postPath),
    `${path.basename(postPath, '.json')}.${kind}.json`
  )
  fs.writeFileSync(p, JSON.stringify(body, null, 2) + '\n')
  return p
}

async function fb() {
  if (post.results.facebook && !DRY)
    die(`facebook already posted: ${post.results.facebook.permalink}`)
  const url = blobUrl('ig') ?? die('upload the IG file first')
  const c = caption('Facebook')
  const m = manifest('fb', {
    video_url: url,
    bytes: post.results.blob.ig.bytes,
    caption: c,
    ...(post.facebook ?? {}),
  })
  const out = run([
    'node',
    `${SCRIPTS}/fb-reel-schedule.mjs`,
    m,
    ...(DRY ? ['--dry'] : []),
  ])
  if (DRY) return
  const last = JSON.parse(
    out
      .trim()
      .split('\n')
      .filter((l) => l.startsWith('{'))
      .pop()
  )
  post.results.facebook = {
    id: last.video_id,
    permalink: last.permalink,
    scheduled_for: post.facebook?.scheduled_for ?? null,
  }
  save()
}

async function ig() {
  if (post.results.instagram && !DRY)
    die(`instagram already posted: ${post.results.instagram.permalink}`)
  const c = caption('Instagram')
  const issues = lintCaption('Instagram', c)
  if (issues.length)
    die(
      `Instagram caption cannot be edited after publish; fix first: ${issues.join(', ')}`
    )
  const url = blobUrl('ig') ?? die('upload the IG file first')
  const m = manifest('ig', {
    video_url: url,
    collaborators: post.collaborators ?? [],
    ...(blobUrl('ig_cover') ? { cover_url: blobUrl('ig_cover') } : {}),
    caption: c,
  })
  const out = run([
    'node',
    `${SCRIPTS}/ig-publish-now.mjs`,
    m,
    ...(DRY ? ['--dry'] : []),
  ])
  if (DRY) return
  const permalink =
    out.match(/^PUBLISHED (\S+)/m)?.[1] ??
    die('no PUBLISHED line from ig-publish-now')
  post.results.instagram = {
    id: permalink.match(/\/reel\/([^/]+)/)[1],
    permalink,
    posted_at: out.match(/^timestamp (\S+)/m)?.[1],
  }
  save()
}

/* Each platform's id, permalink and time, read back from the platform rather than typed in. */
async function resolve(platform, id) {
  if (platform === 'facebook') {
    const r = post.results.facebook ?? die('no facebook result; run fb first')
    const v = await (
      await fetch(
        `${G}/${r.id}?fields=created_time,published,status&access_token=${env.META_PAGE_ACCESS_TOKEN}`
      )
    ).json()
    if (v.error) die(`facebook: ${JSON.stringify(v.error)}`)
    console.log(
      `facebook: published=${v.published}, ${v.status?.video_status}, copyright ${JSON.stringify(v.status?.copyright_check_status)}`
    )
    return {
      id: r.id,
      permalink: r.permalink,
      at: v.created_time,
      measured: true,
      status: v.published ? 'published' : 'scheduled',
      caption: caption('Facebook'),
    }
  }
  if (platform === 'instagram') {
    const r = post.results.instagram ?? die('no instagram result; run ig first')
    return {
      id: r.id,
      permalink: r.permalink,
      at: r.posted_at,
      measured: true,
      status: 'published',
      caption: caption('Instagram'),
      collaborators: (post.collaborators ?? []).join(','),
    }
  }
  if (platform === 'youtube') {
    if (!id) die('record youtube <video-id>')
    const j = await (
      await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${id}&part=status,snippet,contentDetails&key=${env.YOUTUBE_API_KEY}`
      )
    ).json()
    const v =
      j.items?.[0] ?? die(`youtube ${id}: not found (private, or a wrong id)`)
    console.log(
      `youtube: ${v.status.privacyStatus}, ${v.status.uploadStatus}, embeddable=${v.status.embeddable}, region=${JSON.stringify(v.contentDetails.regionRestriction ?? null)}`
    )
    if (v.snippet.title !== post.title)
      console.log(`  WARNING title on YouTube differs: ${v.snippet.title}`)
    const d = v.contentDetails.duration.match(
      /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
    )
    return {
      id,
      permalink: `https://youtu.be/${id}`,
      at: v.snippet.publishedAt,
      measured: true,
      status: v.status.privacyStatus === 'public' ? 'published' : 'scheduled',
      caption: caption('YouTube'),
      public:
        v.status.privacyStatus === 'public' &&
        v.status.uploadStatus === 'processed' &&
        v.status.embeddable,
      seconds: (+d[1] || 0) * 3600 + (+d[2] || 0) * 60 + (+d[3] || 0),
    }
  }
  if (platform === 'tiktok') {
    if (!/^\d{19}$/.test(id ?? '')) die('record tiktok <19-digit video id>')
    // The top 32 bits of a TikTok id are its Unix time. oEmbed stopped returning captions (30 Oct
    // 2026), so the time is the check that this id is the post just made.
    const at = new Date(Number(BigInt(id) >> 32n) * 1000).toISOString()
    console.log(
      `tiktok: id time ${at} (${Math.round((Date.now() - Date.parse(at)) / 60000)} min ago)`
    )
    return {
      id,
      permalink: `https://www.tiktok.com/@bottb0/video/${id}`,
      at,
      measured: true,
      status: 'published',
      caption: caption('TikTok'),
    }
  }
  if (platform === 'linkedin') {
    const n =
      id?.match(/(\d{19})/)?.[1] ?? die('record linkedin <urn:li:activity:...>')
    const urn = `urn:li:activity:${n}`
    const at = new Date(Number(BigInt(n) >> 22n)).toISOString()
    console.log(
      `linkedin: id time ${at} (${Math.round((Date.now() - Date.parse(at)) / 60000)} min ago)`
    )
    return {
      id: urn,
      permalink: `https://www.linkedin.com/feed/update/${urn}/`,
      at,
      measured: true,
      status: 'published',
      caption: caption('LinkedIn'),
    }
  }
  die(`unknown platform ${platform}`)
}

async function record(platform, id) {
  const r = await resolve(platform, id)
  post.results[platform] = {
    ...(post.results[platform] ?? {}),
    id: r.id,
    permalink: r.permalink,
    posted_at: r.at,
  }
  if (!DRY) save()
  const exists = await sql(
    'select id from posts where platform = $1 and external_id = $2',
    [platform, r.id]
  )
  if (exists.length) console.log(`ledger: ${platform} ${r.id} already recorded`)
  else {
    const utm = ['facebook', 'youtube'].includes(platform)
      ? ['--utm-content', `${post.group}-${platform}`]
      : []
    // `bottb post record` writes immediately: only backfill and harvest are dry without --apply
    // (a --dry control wrote a real row on 30 Oct). So a dry run must not call it at all.
    const recordArgs = [
      'pnpm',
      '-s',
      'bottb',
      'post',
      'record',
      '--platform',
      platform,
      '--external-id',
      r.id,
      '--permalink',
      r.permalink,
      '--posted-at',
      r.at,
      '--status',
      r.status,
      '--posted-via',
      ['facebook', 'instagram'].includes(platform) ? 'api' : 'browser',
      '--group',
      post.group,
      '--event',
      post.event,
      '--band',
      post.band,
      '--content-type',
      'video',
      '--title',
      post.title,
      '--caption',
      r.caption,
      ...(r.collaborators ? ['--collaborators', r.collaborators] : []),
      ...utm,
    ]
    if (DRY)
      console.log(`ledger: would run ${recordArgs.slice(0, 10).join(' ')} …`)
    else run(recordArgs)
  }
  if (platform !== 'youtube') return
  /* The site embeds every `videos` row without filtering on published_at, so a private or
   * scheduled id renders a broken embed: insert only once YouTube itself says public. */
  if (!r.public)
    return console.log(
      'website: not inserting the videos row until YouTube is public, processed and embeddable'
    )
  const have = await sql('select id from videos where youtube_video_id = $1', [
    r.id,
  ])
  if (have.length) return console.log('website: videos row already there')
  if (DRY)
    return console.log(
      `website: would insert videos row ${r.id}, ${r.seconds}s`
    )
  const row = await sql(
    `insert into videos (youtube_video_id, title, event_id, band_id, duration_seconds, thumbnail_url, published_at, sort_order, video_type)
     values ($1, $2, $3, $4, $5, $6, $7, 0, 'video') returning id`,
    [
      r.id,
      post.title,
      post.event,
      post.band,
      r.seconds,
      `https://i.ytimg.com/vi/${r.id}/hqdefault.jpg`,
      r.at,
    ]
  )
  console.log(`website: videos row ${row[0].id}`)
}

if (cmd === 'check') await check()
else if (cmd === 'upload') await upload()
else if (cmd === 'fb') await fb()
else if (cmd === 'ig') await ig()
else if (cmd === 'record') await record(rest[0], rest[1])
else if (cmd === 'whatsapp')
  run(['pnpm', '-s', 'bottb', 'post', 'whatsapp', '--group', post.group])
else die(`unknown command ${cmd}`)
