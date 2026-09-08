#!/usr/bin/env node
/**
 * Offline YouTube thumbnail generator — the same layout as the in-app
 * generator (/admin/thumbnails), run from the terminal against local stills.
 *
 * Needs @napi-rs/canvas (prebuilt, no compile):
 *   npm i @napi-rs/canvas          # in a scratch dir, then run with that cwd
 *
 * Usage:
 *   node render.mjs \
 *     --artist "Fleetwood Mac" --song "The Chain" \
 *     --company /path/epsilon-logo.png \
 *     --out /Volumes/BOTTB/Renders/Thumbnails/TheChain \
 *     --label A-keys-vocal:/path/still1.jpg --label B-crowd:/path/still2.jpg
 *
 * Options:
 *   --version "<text>"     small dim line under the artist (cover-of-a-cover)
 *   --corner top-left      put the BoTTB square top-left (default top-right)
 *   --focus 0.5,0.35       focal point for the cover crop (x,y in 0..1)
 *
 * Stills come from gigstills selects; extract at 4K with
 *   ffmpeg -ss <t> -i <clip> -frames:v 1 -q:v 2 still.jpg
 * YouTube caps thumbnails at 2 MB — this shrinks JPEG quality until it fits.
 */
import {
  composeYouTube,
  trimTransparent,
  createCanvas,
  loadImage,
  YT_W,
  YT_H,
  REPO,
} from './compose.mjs'
import fs from 'node:fs'
import path from 'node:path'

const argv = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : argv[i + 1]
}
const many = (name) =>
  argv.flatMap((a, i) => (a === `--${name}` ? [argv[i + 1]] : []))

const artist = opt('artist')
const song = opt('song')
const outDir = opt('out')
const labels = many('label')
if (!artist || !song || !outDir || labels.length === 0) {
  console.error(
    'usage: render.mjs --artist X --song Y --out DIR --label name:still.jpg [...]'
  )
  process.exit(1)
}
const [focusX, focusY] = opt('focus', '0.5,0.5').split(',').map(Number)

const bottb = await loadImage(
  opt('bottb', path.join(REPO, 'public/images/logos/bottb-square-black.png'))
)
const companies = []
for (const p of many('company'))
  companies.push(trimTransparent(await loadImage(p)))

const content = {
  artist,
  song,
  version: opt('version'),
  bottbLogo: bottb,
  companyLogos: companies,
  bottbCorner: opt('corner', 'top-right'),
}

const MAX = 2 * 1024 * 1024 // YouTube's thumbnail ceiling
fs.mkdirSync(outDir, { recursive: true })
for (const spec of labels) {
  const idx = spec.indexOf(':')
  const label = spec.slice(0, idx)
  const still = spec.slice(idx + 1)
  const img = await loadImage(still)
  const canvas = createCanvas(YT_W, YT_H)
  composeYouTube(
    canvas.getContext('2d'),
    img,
    img.width,
    img.height,
    content,
    focusX,
    focusY
  )
  let q = 92
  let buf = canvas.toBuffer('image/jpeg', q)
  while (buf.length > MAX && q > 40)
    buf = canvas.toBuffer('image/jpeg', (q -= 6))
  const out = path.join(outDir, `${label}.jpg`)
  fs.writeFileSync(out, buf)
  console.log(
    `${out}  ${(buf.length / 1024).toFixed(0)} KB  (from ${img.width}x${img.height})`
  )
}
