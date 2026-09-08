// Offline port of src/app/admin/thumbnails/compose.ts (composeYouTube) +
// src/lib/canvas.ts helpers, for node via @napi-rs/canvas.
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// public/fonts/jost-latin.woff2, relative to this file inside the repo.
const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..'
)
GlobalFonts.registerFromPath(
  path.join(REPO, 'public/fonts/jost-latin.woff2'),
  'Jost'
)
export { REPO }

export const YT_W = 1920,
  YT_H = 1080
const FONT_FAMILY = 'Jost'
const SAFE_X = 0.06,
  SAFE_TOP = 0.07,
  SAFE_BOTTOM = 0.115
const MIN_TYPE = { hero: 0.06, primary: 0.038, secondary: 0.032, label: 0.024 }
const safeInsets = (w, h) => ({
  x: Math.round(w * SAFE_X),
  top: Math.round(h * SAFE_TOP),
  bottom: Math.round(h * SAFE_BOTTOM),
})

function drawCover(ctx, src, sw, sh, dx, dy, dw, dh, fx = 0.5, fy = 0.5) {
  if (!sw || !sh) return
  const scale = Math.max(dw / sw, dh / sh),
    w = sw * scale,
    h = sh * scale
  ctx.drawImage(src, dx + (dw - w) * fx, dy + (dh - h) * fy, w, h)
}
const natural = (img) => ({
  w: img.naturalWidth || img.width || 1,
  h: img.naturalHeight || img.height || 1,
})
function fitContain(nw, nh, mw, mh) {
  if (!nw || !nh) return { w: mw, h: mh }
  const s = Math.min(mw / nw, mh / nh)
  return { w: nw * s, h: nh * s }
}

const RASTER_TARGET = 1600
export function trimTransparent(img) {
  const { w: natW, h: natH } = natural(img)
  const scale = Math.max(1, RASTER_TARGET / Math.max(natW, natH))
  const w = Math.round(natW * scale),
    h = Math.round(natH * scale)
  const c = createCanvas(w, h)
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  let top = h,
    bottom = -1,
    left = w,
    right = -1
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (y < top) top = y
        if (y > bottom) bottom = y
        if (x < left) left = x
        if (x > right) right = x
      }
    }
  if (bottom < 0) return img
  if (top === 0 && left === 0 && bottom === h - 1 && right === w - 1) return c
  const t = createCanvas(right - left + 1, bottom - top + 1)
  t.getContext('2d').drawImage(c, -left, -top)
  return t
}

const WIDTH_PENALTY = 0.62
function drawLogoRow(ctx, logos, { x, centerY, align, maxW, maxH, gap }) {
  if (!logos.length) return 0
  const aspects = logos.map((i) => {
    const { w, h } = natural(i)
    return w / h
  })
  const squarest = Math.min(...aspects)
  let sizes = aspects.map((a) =>
    fitContain(a, 1, maxW, maxH * Math.pow(squarest / a, WIDTH_PENALTY))
  )
  const totalGap = gap * (sizes.length - 1)
  const rowW = sizes.reduce((s, v) => s + v.w, 0) + totalGap
  if (rowW > maxW) {
    const s = (maxW - totalGap) / (rowW - totalGap)
    sizes = sizes.map((v) => ({ w: v.w * s, h: v.h * s }))
  }
  const finalW = sizes.reduce((s, v) => s + v.w, 0) + totalGap
  const rowH = Math.max(...sizes.map((s) => s.h))
  const bottomY = centerY + rowH / 2
  let cursor = align === 'left' ? x : x - finalW
  logos.forEach((img, i) => {
    const { w, h } = sizes[i]
    ctx.drawImage(img, cursor, bottomY - h, w, h)
    cursor += w + gap
  })
  return finalW
}

function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const lines = []
  let cur = words[0]
  for (let i = 1; i < words.length; i++) {
    const cand = `${cur} ${words[i]}`
    if (
      ctx.measureText(cand).width <= maxWidth ||
      lines.length === maxLines - 1
    )
      cur = cand
    else {
      lines.push(cur)
      cur = words[i]
    }
  }
  lines.push(cur)
  return lines.slice(0, maxLines)
}
function fitFont(ctx, text, weight, startSize, maxWidth, minSize = 18) {
  let size = startSize
  ctx.font = `${weight} ${size}px ${FONT_FAMILY}`
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 2
    ctx.font = `${weight} ${size}px ${FONT_FAMILY}`
  }
  return size
}
function fitArtist(ctx, artist, h, maxWidth) {
  const start = Math.round(h * 0.125),
    floor = Math.round(h * MIN_TYPE.hero)
  const oneLine = fitFont(
    ctx,
    artist,
    700,
    start,
    maxWidth,
    Math.max(floor, Math.round(start * 0.8))
  )
  ctx.font = `700 ${oneLine}px ${FONT_FAMILY}`
  if (ctx.measureText(artist).width <= maxWidth)
    return { size: oneLine, lines: [artist] }
  const size = fitFont(ctx, artist, 700, oneLine, maxWidth * 1.9, floor)
  ctx.font = `700 ${size}px ${FONT_FAMILY}`
  return { size, lines: wrapLines(ctx, artist, maxWidth, 2) }
}

function drawAdornments(ctx, w, h, content) {
  const safe = safeInsets(w, h)
  const bottbSize = Math.round(h * 0.17)
  const centerY = safe.top + bottbSize / 2
  const onRight = content.bottbCorner === 'top-right'
  if (content.bottbLogo) {
    const x = onRight ? w - safe.x - bottbSize : safe.x
    ctx.drawImage(content.bottbLogo, x, safe.top, bottbSize, bottbSize)
  }
  const single = content.companyLogos.length === 1
  drawLogoRow(ctx, content.companyLogos, {
    x: onRight ? safe.x : w - safe.x,
    align: onRight ? 'left' : 'right',
    centerY,
    maxW: Math.round(w * (single ? 0.26 : 0.4)),
    maxH: Math.round(h * 0.14),
    gap: Math.round(w * 0.02),
  })
  const artist = (content.artist || '').trim(),
    song = (content.song || '').trim()
  const maxTextW = w - safe.x * 2
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.shadowColor = 'rgba(0,0,0,0.85)'
  ctx.shadowBlur = Math.round(h * 0.014)
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = Math.round(h * 0.006)
  ctx.fillStyle = '#ffffff'
  let baseline = h - safe.bottom
  if (song) {
    const size = fitFont(
      ctx,
      song,
      500,
      Math.round(h * 0.078),
      maxTextW,
      Math.round(h * MIN_TYPE.primary)
    )
    ctx.font = `500 ${size}px ${FONT_FAMILY}`
    ctx.fillText(song, safe.x, baseline)
    baseline -= size * 1.25
  }
  const version = content.version && content.version.trim()
  if (version) {
    const size = fitFont(
      ctx,
      version,
      500,
      Math.round(h * 0.048),
      maxTextW,
      Math.round(h * MIN_TYPE.label)
    )
    ctx.font = `500 ${size}px ${FONT_FAMILY}`
    ctx.fillStyle = 'rgba(255,255,255,0.78)'
    ctx.fillText(version, safe.x, baseline)
    ctx.fillStyle = '#ffffff'
    baseline -= size * 1.5
  }
  if (artist) {
    const { size, lines } = fitArtist(ctx, artist, h, maxTextW)
    ctx.font = `700 ${size}px ${FONT_FAMILY}`
    for (let i = lines.length - 1; i >= 0; i--) {
      ctx.fillText(lines[i], safe.x, baseline)
      baseline -= size * 1.12
    }
  }
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
}

export function composeYouTube(
  ctx,
  source,
  sw,
  sh,
  content,
  focusX = 0.5,
  focusY = 0.5
) {
  ctx.clearRect(0, 0, YT_W, YT_H)
  if (source) drawCover(ctx, source, sw, sh, 0, 0, YT_W, YT_H, focusX, focusY)
  else {
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, YT_W, YT_H)
  }
  const top = ctx.createLinearGradient(0, 0, 0, YT_H * 0.3)
  top.addColorStop(0, 'rgba(0,0,0,0.45)')
  top.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, YT_W, YT_H * 0.3)
  const bottom = ctx.createLinearGradient(0, YT_H * 0.45, 0, YT_H)
  bottom.addColorStop(0, 'rgba(0,0,0,0)')
  bottom.addColorStop(1, 'rgba(0,0,0,0.8)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, YT_H * 0.45, YT_W, YT_H * 0.55)
  drawAdornments(ctx, YT_W, YT_H, content)
}

export { createCanvas, loadImage, fs }
