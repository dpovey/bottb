#!/usr/bin/env node
/*
 * Build an Instagram Reels container from an ALREADY-UPLOADED Blob URL and publish it immediately.
 *
 *   node doc/production/scripts/ig-publish-now.mjs <manifest.json> [--probe-only] [--dry]
 *
 * MUST be run with the repo root as cwd (it reads .env.local from there) — see the runbook's
 * blob-upload note; a copy run out of the scratchpad dies with ERR_MODULE_NOT_FOUND.
 *
 * Instagram has no scheduling API. This script exists so that publishing is ONE command at the
 * slot, runnable by a session cron, by another session, or by Dean pasting it into a terminal.
 * Containers expire in ~24 h and in practice every pre-built one has died before its slot, so this
 * builds the container and publishes it in a single pass (~1-2 min).
 *
 * manifest.json:
 *   { "video_url": "https://...blob...mp4",     // 1080p, <= 300 MB. NOT the 4K master.
 *     "caption":   "...",
 *     "collaborators": ["quirkylikethat", "kurtboldy", "youngcareoz"],   // max 3
 *     "cover_url": "https://...jpg"             // optional; JPEG <= 8 MB, overrides thumb_offset
 *   }
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
const TOK = env.META_PAGE_ACCESS_TOKEN
const IG = '17841461862790198'
const G = 'https://graph.facebook.com/v21.0'

const args = process.argv.slice(2)
const manifestPath = args.find((a) => !a.startsWith('--'))
const PROBE_ONLY = args.includes('--probe-only')
const DRY = args.includes('--dry')
if (!manifestPath) {
  console.error(
    'usage: ig-publish-now.mjs <manifest.json> [--probe-only] [--dry]'
  )
  process.exit(2)
}
const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
if (!m.video_url || !m.caption)
  throw new Error('manifest needs video_url and caption')
const collabs = m.collaborators ?? []
if (collabs.length > 3)
  throw new Error(`max 3 collaborators, got ${collabs.length}`)

const q = (o) => new URLSearchParams(o).toString()
const post = async (url, body) => {
  const r = await fetch(url, { method: 'POST', body: q(body) })
  const d = await r.json()
  return { ok: r.ok, d }
}
const get = async (url) => (await fetch(url)).json()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* Size gate. The cap is 300 MB, read from Meta's ig-user/media reference — NOT the "1 GB" that an
 * older runbook inferred from a 4K rejection. Sultans at 517 MB was refused three times while the
 * identical bytes sat published on Facebook. Enforcement is soft near the line, so warn rather than
 * refuse, but say the number. */
const head = await fetch(m.video_url, { method: 'HEAD' })
const bytes = Number(head.headers.get('content-length') || 0)
const MB = bytes / 1e6
console.log(`video_url ${MB.toFixed(1)} MB`)
if (!head.ok) throw new Error(`video_url not reachable: HTTP ${head.status}`)
if (MB > 300)
  console.warn(
    `WARNING: ${MB.toFixed(1)} MB exceeds Instagram's documented 300 MB cap. ` +
      `Expect error 2207053. Re-encode before relying on this.`
  )

/* Probe each collaborator ALONE before building the real container. A single bad handle fails the
 * whole create, and error 210 / subcode 2207066 names only the FIRST bad handle, so a combined
 * attempt tells you almost nothing. Throwaway containers cost nothing and expire unused.
 * Known bad: jumbointeractive (no IG at all — killed a container on 14 Sep), thetriffid (never
 * accepts). Loading instagram.com/<handle> proves NOTHING: a handle invented on the spot returns
 * HTTP 200 exactly like a real one. The API is the only check that works. */
const bad = []
for (const h of collabs) {
  const { ok, d } = await post(`${G}/${IG}/media`, {
    media_type: 'REELS',
    video_url: m.video_url,
    caption: 'probe',
    collaborators: JSON.stringify([h]),
    access_token: TOK,
  })
  if (ok && d.id) console.log(`  collaborator ok       ${h}`)
  else {
    console.log(
      `  collaborator REFUSED  ${h}  ${d.error?.message ?? JSON.stringify(d)}`
    )
    bad.push(h)
  }
}
if (bad.length)
  throw new Error(
    `refused collaborators: ${bad.join(', ')} — fix the list, do not publish with them`
  )
if (PROBE_ONLY) {
  console.log(
    'probe-only: all handles accepted, stopping before the real container'
  )
  process.exit(0)
}
if (DRY) {
  console.log('--- caption as it will post ---')
  console.log(m.caption)
  console.log('--- end ---')
  console.log('dry run: no container built')
  process.exit(0)
}

const params = {
  media_type: 'REELS',
  video_url: m.video_url,
  caption: m.caption,
  share_to_feed: 'true',
  access_token: TOK,
}
if (collabs.length) params.collaborators = JSON.stringify(collabs)
if (m.cover_url) params.cover_url = m.cover_url

const { ok, d: cr } = await post(`${G}/${IG}/media`, params)
if (!ok) throw new Error(`container create failed: ${JSON.stringify(cr)}`)
console.log('container', cr.id)

let status = 'IN_PROGRESS'
for (let i = 0; i < 60 && status === 'IN_PROGRESS'; i++) {
  await sleep(10000)
  const s = await get(
    `${G}/${cr.id}?fields=status_code,status&access_token=${TOK}`
  )
  status = s.status_code
  if (status === 'ERROR')
    throw new Error(`container ERROR: ${s.status ?? '(no detail)'}`)
  process.stdout.write(`  ${status} `)
}
console.log()
if (status !== 'FINISHED')
  throw new Error(`container never finished, last status ${status}`)

const { ok: pok, d: pub } = await post(`${G}/${IG}/media_publish`, {
  creation_id: cr.id,
  access_token: TOK,
})
if (!pok) throw new Error(`publish failed: ${JSON.stringify(pub)}`)

const info = await get(
  `${G}/${pub.id}?fields=permalink,timestamp&access_token=${TOK}`
)
console.log('PUBLISHED', info.permalink)
console.log('timestamp', info.timestamp)
/* Record scheduled-vs-actual: a session cron fires only when the REPL is idle, and Sultans slipped
 * four hours on 16 Sep without anyone noticing. A bare "published" line hides that. */
if (m.intended_slot)
  console.log('intended slot', m.intended_slot, '<-- compare against timestamp')
