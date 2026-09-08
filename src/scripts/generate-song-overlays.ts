#!/usr/bin/env tsx
/**
 * Headless song-overlay generator: renders the same transparent 3840x2160
 * song title cards as the admin band-set page (songs tab), without a browser.
 * Usage: pnpm tsx src/scripts/generate-song-overlays.ts --event brisbane --band "off the record" [--out DIR]
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createCanvas, GlobalFonts, loadImage as napiLoad } from '@napi-rs/canvas'
import { sql } from '@vercel/postgres'
import fs from 'node:fs'
import path from 'node:path'

// --- DOM shims so the repo's canvas helpers run in Node -------------------
;(globalThis as any).document = {
  createElement(tag: string) {
    if (tag !== 'canvas') throw new Error(`shim: unsupported ${tag}`)
    return createCanvas(1, 1)
  },
}
GlobalFonts.registerFromPath(path.join(process.cwd(), 'public/fonts/jost-latin.woff2'), 'Jost')

import { composeOverlay, OV_W, OV_H } from '../app/admin/thumbnails/compose'
import { songCredit } from '../app/admin/thumbnails/setlist-artist'
import { trimTransparent } from '../lib/canvas'

const args = process.argv.slice(2)
const get = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined }
const eventQ = (get('event') ?? 'brisbane').toLowerCase()
const bandQ = get('band')?.toLowerCase()
const outBase = get('out') ?? '/Volumes/Extreme SSD/bottb/events/2026/Brisbane/02_Production'

const slug = (s: string) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function main() {
  const { rows: events } = await sql`SELECT id, name FROM events WHERE LOWER(name) LIKE ${'%' + eventQ + '%'} ORDER BY date DESC`
  if (!events.length) throw new Error(`no event matching '${eventQ}'`)
  const event = events[0]
  console.log('event:', event.id, event.name)

  const { rows: bands } = await sql`
    SELECT b.id, b.name,
      COALESCE((SELECT json_agg(json_build_object('name', c2.name, 'logo_url', c2.logo_url) ORDER BY bc.is_primary DESC, bc.position)
        FROM band_companies bc JOIN companies c2 ON c2.slug = bc.company_slug WHERE bc.band_id = b.id), '[]'::json) as companies,
      c.logo_url as company_logo_url
    FROM bands b LEFT JOIN companies c ON b.company_slug = c.slug
    WHERE b.event_id = ${event.id} ORDER BY b."order"`
  const bottb = await napiLoad(path.join(process.cwd(), 'public/images/logos/bottb-square-black.png'))

  for (const band of bands) {
    if (bandQ && !band.name.toLowerCase().includes(bandQ)) continue
    const { rows: songs } = await sql`SELECT s.* FROM setlist_songs s WHERE s.band_id = ${band.id} ORDER BY s.position ASC`
    if (!songs.length) { console.log(`-- ${band.name}: no setlist, skipped`); continue }
    const logoUrls: string[] = (band.companies as any[]).map((c) => c.logo_url).filter(Boolean)
    if (!logoUrls.length && band.company_logo_url) logoUrls.push(band.company_logo_url)
    const companyLogos = []
    for (const u of logoUrls) {
      try { companyLogos.push(trimTransparent((await napiLoad(u)) as any)) }
      catch (e) { console.warn(`   logo failed ${u}: ${e}`) }
    }
    const dir = path.join(outBase, band.name, 'Overlays')
    fs.mkdirSync(dir, { recursive: true })
    let n = 0
    for (const song of songs) {
      const credit = songCredit(song as any)
      const canvas = createCanvas(OV_W, OV_H)
      const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D
      composeOverlay(ctx, { artist: credit.artist, song: credit.title, version: credit.version, bottbLogo: bottb as any, companyLogos: companyLogos as any, bottbCorner: 'top-right' }, OV_W, OV_H)
      const file = path.join(dir, `${String(++n).padStart(2, '0')}-${slug(credit.title)}.png`)
      fs.writeFileSync(file, canvas.toBuffer('image/png'))
      console.log('  wrote', file)
    }
    console.log(`-- ${band.name}: ${n} cards`)
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
