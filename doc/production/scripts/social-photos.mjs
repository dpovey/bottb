#!/usr/bin/env node
/**
 * Post a photo carousel folder to Facebook (multi-photo feed post).
 * Run from the repo root: node doc/production/scripts/social-photos.mjs <folder> [--when <iso>] [--dry]
 *
 * Folder must contain post.json (images[] with file+alt), and caption.fb.txt.
 * Handles Facebook (multi-photo feed post) and Instagram (carousel).
 *
 * Posting IG through the API is BETTER than scheduling it from Business Suite:
 * `collaborators` can be set on the carousel container at creation, so the invite
 * goes out with the post instead of having to be added by hand afterwards.
 * (Business Suite drops collaborators on scheduled posts.) The tradeoff is that
 * the API cannot schedule — the post goes live when this runs.
 */
import fs from 'fs'
import path from 'path'
import { put } from '@vercel/blob'

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
const PAGE = env.META_PAGE_ID
const G = 'https://graph.facebook.com/v21.0'

const folder = process.argv[2]
const dry = process.argv.includes('--dry')
const whenIdx = process.argv.indexOf('--when')
const when = whenIdx === -1 ? null : process.argv[whenIdx + 1]
if (!folder) {
  console.error('usage: social-photos.mjs <folder> [--when <iso>] [--dry]')
  process.exit(1)
}

const post = JSON.parse(fs.readFileSync(path.join(folder, 'post.json'), 'utf8'))
const caption = fs
  .readFileSync(path.join(folder, 'caption.fb.txt'), 'utf8')
  .trim()

const j = async (u, o) => {
  const r = await fetch(u, o)
  const d = await r.json()
  if (!r.ok) throw new Error(JSON.stringify(d))
  return d
}
const q = (o) => new URLSearchParams(o).toString()

console.log(
  `post: ${post.post}  slides: ${post.images.length}  scheduled: ${when || 'now'}`
)
console.log('--- caption ---')
console.log(caption)
console.log('---------------')
if (dry) {
  console.log('DRY RUN, nothing sent')
  process.exit(0)
}

// 1. every slide to Blob (Meta needs a public URL)
const urls = []
for (const im of post.images) {
  const local = path.join(folder, im.file)
  const up = await put(
    `social/brisbane-2026/photos/${post.post}/${im.file}`,
    fs.readFileSync(local),
    {
      access: 'public',
      token: env.BLOB_READ_WRITE_TOKEN,
      contentType: 'image/jpeg',
      addRandomSuffix: false,
      allowOverwrite: true,
    }
  )
  urls.push({ url: up.url, alt: im.alt })
  console.log(`  blob ${im.file} -> ${up.url}`)
}

// 2. unpublished photo per slide  (Facebook leg — opt in with --fb)
if (process.argv.includes('--fb')) {
  const fbids = []
  for (const u of urls) {
    const r = await j(`${G}/${PAGE}/photos`, {
      method: 'POST',
      body: q({
        url: u.url,
        published: 'false',
        alt_text_custom: u.alt,
        access_token: TOK,
      }),
    })
    fbids.push(r.id)
    console.log(`  fb photo ${r.id}`)
  }

  // 3. one feed post attaching them all
  const body = { message: caption, access_token: TOK }
  fbids.forEach((id, i) => {
    body[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })
  })
  if (when) {
    body.published = 'false'
    body.scheduled_publish_time = String(
      Math.floor(new Date(when).getTime() / 1000)
    )
  }
  const res = await j(`${G}/${PAGE}/feed`, { method: 'POST', body: q(body) })
  console.log('FB_POST_ID', res.id)

  // Read the permalink back rather than constructing one: the page id is NOT the id
  // that appears in a post URL, so a hand-built link 404s. Also confirms it published.
  const check = await j(
    `${G}/${res.id}?fields=id,created_time,is_published,permalink_url&access_token=${TOK}`
  )
  console.log('is_published', check.is_published)
  console.log('created_time', check.created_time)
  console.log('permalink', check.permalink_url)
}

// ---------------------------------------------------------------- Instagram
// Containers expire in ~24h, so they are built here at publish time, never earlier.
if (process.argv.includes('--ig')) {
  const IG = '17841461862790198'
  const igCaption = fs
    .readFileSync(path.join(folder, 'caption.ig.txt'), 'utf8')
    .trim()
  const children = []
  for (let i = 0; i < urls.length; i++) {
    const c = await j(`${G}/${IG}/media`, {
      method: 'POST',
      body: q({
        image_url: urls[i].url,
        is_carousel_item: 'true',
        alt_text: urls[i].alt,
        access_token: TOK,
      }),
    })
    children.push(c.id)
    console.log(`  ig child ${i + 1}/${urls.length} ${c.id}`)
  }
  const parentBody = {
    media_type: 'CAROUSEL',
    children: children.join(','),
    caption: igCaption,
    access_token: TOK,
  }
  const collabs = (post.collaborators || []).slice(0, 3)
  if (collabs.length) parentBody.collaborators = JSON.stringify(collabs)
  const parent = await j(`${G}/${IG}/media`, {
    method: 'POST',
    body: q(parentBody),
  })
  console.log('  ig container', parent.id, 'collaborators', collabs.join(', '))
  // Poll before publishing. A carousel container is often not ready the instant it
  // is created and media_publish then fails with 2207027 "Media ID is not available".
  // NEVER rebuild the container on that error — it is valid for ~24h and rebuilding
  // risks publishing twice. Just wait for status_code FINISHED.
  for (let i = 0; i < 30; i++) {
    const st = await j(
      `${G}/${parent.id}?fields=status_code&access_token=${TOK}`
    )
    if (st.status_code === 'FINISHED') break
    if (st.status_code === 'ERROR')
      throw new Error(`container ${parent.id} errored`)
    console.log(`  waiting for container (${st.status_code})`)
    await new Promise((r) => setTimeout(r, 5000))
  }
  const pub = await j(`${G}/${IG}/media_publish`, {
    method: 'POST',
    body: q({ creation_id: parent.id, access_token: TOK }),
  })
  const info = await j(
    `${G}/${pub.id}?fields=permalink,timestamp&access_token=${TOK}`
  )
  console.log('IG_POST_ID', pub.id)
  console.log('ig permalink', info.permalink)
}
