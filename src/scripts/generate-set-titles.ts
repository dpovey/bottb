#!/usr/bin/env tsx
/**
 * Headless set-title generator: renders the same 3840x2160 title and credits
 * cards as the admin band-set page, without a browser.
 *
 * Usage:
 *   pnpm tsx src/scripts/generate-set-titles.ts --event "sydney 2025" \
 *     --band "incident commanders" --style filmic [--no-members] [--no-scrim] --out DIR
 *
 * Writes <DIR>/title-filmic.png and <DIR>/credits-filmic[-nomembers].png
 * (filmic), or <DIR>/title-classic.png and <DIR>/credits-classic.png.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import {
  createCanvas,
  GlobalFonts,
  loadImage as napiLoad,
} from '@napi-rs/canvas'
import { sql } from '@vercel/postgres'
import fs from 'node:fs'
import path from 'node:path'

// --- DOM shims so the repo's canvas helpers run in Node -------------------
;(globalThis as unknown as { document: unknown }).document = {
  createElement(tag: string) {
    if (tag !== 'canvas') throw new Error(`shim: unsupported ${tag}`)
    return createCanvas(1, 1)
  },
}
GlobalFonts.registerFromPath(
  path.join(process.cwd(), 'public/fonts/jost-latin.woff2'),
  'Jost'
)

import {
  composeCreditsOverlay,
  composeTitleOverlay,
  OV_H,
  OV_W,
} from '../app/admin/band-set/compose'
import {
  cityFromEventName,
  composeFilmicCredits,
  composeFilmicTitle,
  filmicDate,
  type SetCardStyle,
} from '../app/admin/band-set/filmic'
import { keyOpaqueLogo, type LogoSource, trimTransparent } from '../lib/canvas'
import { formatEventDateLabel } from '../lib/date-utils'

const args = process.argv.slice(2)
const get = (k: string) => {
  const i = args.indexOf(`--${k}`)
  return i >= 0 ? args[i + 1] : undefined
}
const has = (k: string) => args.includes(`--${k}`)

const eventQ = get('event')?.toLowerCase()
const bandQ = get('band')?.toLowerCase()
const style = (get('style') ?? 'filmic') as SetCardStyle
const showMembers = !has('no-members')
const scrim = !has('no-scrim')
const outDir = get('out')

// SVG logos rasterise at their declared width/height: Canva's logo.svg declares 80x30, so it came
// out pixelated on 4K cards (Canvanauts full set, 2026-10-04). Scale the declared size up first,
// keeping the viewBox, so the vector is drawn at full resolution.
async function loadSharp(src: string) {
  if (!/\.svg(\?|$)/i.test(src)) return napiLoad(src)
  const text = /^https?:/i.test(src)
    ? await (await fetch(src)).text()
    : fs.readFileSync(src, 'utf8')
  const scaled = text.replace(/<svg\b[^>]*>/i, (tag) => {
    if (!/viewBox=/i.test(tag)) return tag
    const num = (k: string) =>
      parseFloat(new RegExp(`(?<![-\\w])${k}="([\\d.]+)`).exec(tag)?.[1] ?? '')
    const w = num('width')
    const h = num('height')
    if (!w || !h) return tag
    const k = 2400 / Math.max(w, h)
    return tag
      .replace(/(?<![-\w])width="[\d.]+(px)?"/, `width="${Math.round(w * k)}"`)
      .replace(
        /(?<![-\w])height="[\d.]+(px)?"/,
        `height="${Math.round(h * k)}"`
      )
  })
  return napiLoad(Buffer.from(scaled))
}

type Ctx = CanvasRenderingContext2D
const asLogo = (img: unknown) => img as LogoSource

async function load(
  src: string | null | undefined
): Promise<LogoSource | null> {
  if (!src) return null
  try {
    return asLogo(await loadSharp(src))
  } catch (e) {
    console.warn(`   logo failed ${src}: ${e}`)
    return null
  }
}

async function main() {
  if (!eventQ || !bandQ || !outDir) {
    throw new Error(
      'usage: --event "<event>" --band "<band>" [--style filmic|classic] [--no-members] [--no-scrim] --out DIR'
    )
  }
  if (style !== 'filmic' && style !== 'classic') {
    throw new Error(`unknown --style '${style}'`)
  }

  const { rows: events } =
    await sql`SELECT id, name, date, location, timezone, info FROM events WHERE LOWER(name) LIKE ${'%' + eventQ + '%'} ORDER BY date DESC`
  if (!events.length) throw new Error(`no event matching '${eventQ}'`)
  const event = events[0]
  console.log('event:', event.id, event.name)

  const { rows: bands } = await sql`
    SELECT b.id, b.name, b.info,
      COALESCE((SELECT json_agg(json_build_object('name', c2.name, 'logo_url', c2.logo_url) ORDER BY bc.is_primary DESC, bc.position)
        FROM band_companies bc JOIN companies c2 ON c2.slug = bc.company_slug WHERE bc.band_id = b.id), '[]'::json) as companies,
      c.logo_url as company_logo_url
    FROM bands b LEFT JOIN companies c ON b.company_slug = c.slug
    WHERE b.event_id = ${event.id} ORDER BY b."order"`
  const band = bands.find((b) => b.name.toLowerCase().includes(bandQ))
  if (!band) throw new Error(`no band matching '${bandQ}' at ${event.name}`)
  console.log('band:', band.id, band.name)

  const logoUrls: string[] = (band.companies as { logo_url?: string }[])
    .map((c) => c.logo_url)
    .filter((u): u is string => Boolean(u))
  if (!logoUrls.length && band.company_logo_url)
    logoUrls.push(band.company_logo_url)
  const companyLogos: LogoSource[] = []
  for (const url of logoUrls) {
    const img = await load(url)
    if (img) companyLogos.push(trimTransparent(img))
  }

  const info = (band.info ?? {}) as { logo_url?: string; members?: string[] }
  const members = (info.members ?? []).map((name) => ({ name }))
  const bandLogo = await load(info.logo_url)
  const partnerLogo = await load(event.info?.national_partner?.logo_url)
  const youngcare = await load(
    path.join(process.cwd(), 'public/images/logos/youngcare.png')
  )

  const dateLabel = formatEventDateLabel(
    new Date(event.date).toISOString(),
    event.timezone,
    event.info
  )
  fs.mkdirSync(outDir, { recursive: true })

  const write = (name: string, draw: (ctx: Ctx) => void) => {
    const canvas = createCanvas(OV_W, OV_H)
    draw(canvas.getContext('2d') as unknown as Ctx)
    const file = path.join(outDir, name)
    fs.writeFileSync(file, canvas.toBuffer('image/png'))
    console.log('  wrote', file)
  }

  if (style === 'filmic') {
    const place = {
      venue: event.location as string,
      city: cityFromEventName(event.name),
      date: filmicDate(dateLabel),
    }
    const bottbHorizontal = await load(
      path.join(process.cwd(), 'public/images/logos/bottb-horizontal.png')
    )
    const trim = (img: LogoSource | null) => img && trimTransparent(img)
    write('title-filmic.png', (ctx) =>
      composeFilmicTitle(ctx, {
        ...place,
        bandName: band.name,
        bandLogo: bandLogo && trimTransparent(keyOpaqueLogo(bandLogo)),
        companyLogos,
      })
    )
    const noMembers = !showMembers || members.length === 0
    if (showMembers && members.length === 0) {
      console.log('  (no members in the DB: writing the no-members variant)')
    }
    write(`credits-filmic${noMembers ? '-nomembers' : ''}.png`, (ctx) =>
      composeFilmicCredits(ctx, {
        ...place,
        bandName: band.name,
        members,
        showMembers,
        scrim,
        companyLogos,
        bottbLogo: trim(bottbHorizontal),
        partnerLogo: trim(partnerLogo),
        youngcareLogo: trim(youngcare),
      })
    )
  } else {
    const bottbSquare = await load(
      path.join(process.cwd(), 'public/images/logos/bottb-square-black.png')
    )
    const logos = {
      bottbLogo: bottbSquare as HTMLImageElement | null,
      companyLogos,
      bottbCorner: 'top-right' as const,
      partnerLogo: partnerLogo as HTMLImageElement | null,
      youngcareLogo: youngcare as HTMLImageElement | null,
    }
    write('title-classic.png', (ctx) =>
      composeTitleOverlay(ctx, {
        ...logos,
        bandLogo: bandLogo as HTMLImageElement | null,
        bandName: band.name,
        eventName: event.name,
        // As the admin page prefills it: date only, ordinal kept.
        eventDate: dateLabel.replace(/\s*@.*$/, ''),
        eventVenue: event.location,
      })
    )
    write('credits-classic.png', (ctx) =>
      composeCreditsOverlay(ctx, { ...logos, bandName: band.name, members })
    )
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
