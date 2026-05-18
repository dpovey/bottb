#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'
import { readFileSync, existsSync } from 'fs'
import { basename } from 'path'

import { processAndStorePhoto } from '../lib/photo-upload'

// Load environment variables from .env.local
config({ path: '.env.local' })

interface UploadOptions {
  /**
   * If true, also stamp the URL into `events.info.image_url` for legacy
   * consumers (OG-image, JSON-LD, search index). The canonical lookup is
   * now `getPhotosByLabel(EVENT_HERO, { eventId })`; updating image_url
   * is a transitional belt-and-braces.
   */
  setImageUrl?: boolean
}

async function uploadEventImage(
  eventId: string,
  filePath: string,
  options: UploadOptions = {}
) {
  console.log(`🎪 Uploading event hero for: ${eventId}`)
  console.log(`📁 Source: ${filePath}`)

  if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`)
    process.exit(1)
  }

  const { rows: eventRows } = await sql`
    SELECT id, name FROM events WHERE id = ${eventId}
  `
  if (eventRows.length === 0) {
    console.error(`❌ Event with ID ${eventId} not found`)
    process.exit(1)
  }
  const event = eventRows[0]
  console.log(`✅ Found event: ${event.name}`)

  const buffer = readFileSync(filePath)
  const filename = basename(filePath)

  console.log('🛠️  Processing variants (thumbnail / 2x / medium / large / 4K)…')
  const result = await processAndStorePhoto({
    buffer,
    filename,
    eventId,
    labels: ['event_hero'],
  })

  console.log(`✅ Photo row created: ${result.photoId}`)
  console.log(`   ${result.width}×${result.height}, blob_url:`)
  console.log(`   ${result.blobUrl}`)
  console.log(
    `   medium:    ${result.variants.medium_url ?? '(none — original too small)'}`
  )
  console.log(`   thumbnail: ${result.variants.thumbnail_url}`)

  if (options.setImageUrl) {
    console.log('💾 Stamping events.info.image_url for legacy consumers…')
    await sql`
      UPDATE events
      SET info = jsonb_set(
        COALESCE(info, '{}'::jsonb),
        '{image_url}',
        ${JSON.stringify(result.blobUrl)}::jsonb
      )
      WHERE id = ${eventId}
    `
  }

  console.log(
    `🎉 Done. Hero is queryable via getPhotosByLabel('event_hero', { eventId: '${eventId}' }).`
  )
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--')

  if (args.length < 2 || args.includes('--help') || args.includes('-h')) {
    console.log(`
🎪 Upload event hero image

Usage: pnpm upload-event-image <event-id> <file-path> [--set-image-url]

Processes the image through the WebP variant pipeline (thumbnail / 2x /
medium / large / 4K) and inserts a row in the photos table labelled
'event_hero'. Consumers (event cards, event pages, results) read this
via getPhotosByLabel(EVENT_HERO).

Options:
  --set-image-url   Also stamp events.info.image_url with the new blob_url
                    so legacy consumers (OG image, JSON-LD, search index)
                    pick up the processed variant. Recommended.

Examples:
  pnpm upload-event-image sydney-2025 ./event-photo.jpg --set-image-url
  pnpm upload-event-image melbourne-2026 /path/to/hero.png --set-image-url
`)
    process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1)
  }

  const positional = args.filter((a) => !a.startsWith('--'))
  const setImageUrl = args.includes('--set-image-url')

  const [eventId, filePath] = positional
  await uploadEventImage(eventId, filePath, { setImageUrl })
}

main().catch((err) => {
  console.error('❌ Upload failed:', err)
  process.exit(1)
})
