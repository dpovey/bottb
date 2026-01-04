#!/usr/bin/env npx tsx
/**
 * Regenerate Thumbnails Script
 *
 * Regenerates all photo thumbnails to preserve aspect ratio.
 * This is needed after the focal point fix - old thumbnails were
 * pre-cropped to squares, but new ones preserve aspect ratio so
 * CSS can crop them using the focal point.
 *
 * Usage:
 *   pnpm exec tsx src/scripts/regenerate-thumbnails.ts [options]
 *
 * Options:
 *   --dry-run         Preview what would be regenerated without making changes
 *   --limit <n>       Only process n photos
 *   --event <name>    Only process photos from this event
 *   --verbose         Show detailed progress
 *   --photos-path     Path to original photos directory (optional, uses blob storage if not found)
 */

import { config } from 'dotenv'
import { parseArgs } from 'util'
import { readFile } from 'fs/promises'
import { existsSync, readdirSync, statSync } from 'fs'
import { join, basename, extname } from 'path'
import sharp from 'sharp'
import { put } from '@vercel/blob'
import { sql } from '@vercel/postgres'

// Load environment variables
config({ path: '.env.local' })

// Base path to original photos (for best quality source)
let PHOTOS_BASE_PATH = '/Volumes/Extreme SSD/Google Photos'

interface PhotoRecord {
  id: string
  original_filename: string | null
  blob_url: string
  original_blob_url: string | null
  event_name: string | null
  band_name: string | null
}

/**
 * Get all photos (or filtered subset)
 */
async function getPhotos(
  eventName?: string,
  limit?: number
): Promise<PhotoRecord[]> {
  let query: ReturnType<typeof sql<PhotoRecord>>

  if (eventName && limit) {
    query = sql<PhotoRecord>`
      SELECT 
        p.id,
        p.original_filename,
        p.blob_url,
        p.original_blob_url,
        e.name as event_name,
        b.name as band_name
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      WHERE e.name = ${eventName}
      ORDER BY p.uploaded_at DESC
      LIMIT ${limit}
    `
  } else if (eventName) {
    query = sql<PhotoRecord>`
      SELECT 
        p.id,
        p.original_filename,
        p.blob_url,
        p.original_blob_url,
        e.name as event_name,
        b.name as band_name
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      WHERE e.name = ${eventName}
      ORDER BY p.uploaded_at DESC
    `
  } else if (limit) {
    query = sql<PhotoRecord>`
      SELECT 
        p.id,
        p.original_filename,
        p.blob_url,
        p.original_blob_url,
        e.name as event_name,
        b.name as band_name
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      ORDER BY p.uploaded_at DESC
      LIMIT ${limit}
    `
  } else {
    query = sql<PhotoRecord>`
      SELECT 
        p.id,
        p.original_filename,
        p.blob_url,
        p.original_blob_url,
        e.name as event_name,
        b.name as band_name
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      ORDER BY p.uploaded_at DESC
    `
  }

  const { rows } = await query
  return rows
}

/**
 * Try to find original file on disk for best quality
 */
async function findOriginalFileOnDisk(
  filename: string
): Promise<string | null> {
  if (!existsSync(PHOTOS_BASE_PATH)) {
    return null
  }

  // Try common photo extensions
  const extensions = ['', '.jpg', '.jpeg', '.JPG', '.JPEG', '.png', '.PNG']
  const baseName = filename.replace(/\.[^.]+$/, '')

  // Search recursively (up to 3 levels deep for performance)
  function searchDir(dir: string, depth: number): string | null {
    if (depth > 3) return null

    try {
      const entries = readdirSync(dir)

      for (const entry of entries) {
        const fullPath = join(dir, entry)
        const stat = statSync(fullPath)

        if (stat.isDirectory()) {
          const found = searchDir(fullPath, depth + 1)
          if (found) return found
        } else {
          // Check if this is our file
          const entryBase = basename(entry, extname(entry))
          if (entryBase === baseName || entry === filename) {
            return fullPath
          }
        }
      }
    } catch {
      // Directory might not be accessible, skip
    }

    return null
  }

  return searchDir(PHOTOS_BASE_PATH, 0)
}

/**
 * Regenerate thumbnails for a photo
 */
async function regenerateThumbnails(
  photo: PhotoRecord,
  dryRun: boolean,
  verbose: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    let imageBuffer: Buffer

    // Try to find original file on disk first (best quality)
    if (photo.original_filename) {
      const localFilePath = await findOriginalFileOnDisk(
        photo.original_filename
      )

      if (localFilePath) {
        if (verbose) console.log(`   Using local file: ${localFilePath}`)
        imageBuffer = await readFile(localFilePath)
      } else if (photo.original_blob_url) {
        if (verbose)
          console.log(`   Using original blob: ${photo.original_blob_url}`)
        const response = await fetch(photo.original_blob_url)
        if (!response.ok)
          throw new Error(`Failed to fetch original: ${response.statusText}`)
        imageBuffer = Buffer.from(await response.arrayBuffer())
      } else {
        if (verbose) console.log(`   Using large.webp: ${photo.blob_url}`)
        const response = await fetch(photo.blob_url)
        if (!response.ok)
          throw new Error(`Failed to fetch: ${response.statusText}`)
        imageBuffer = Buffer.from(await response.arrayBuffer())
      }
    } else if (photo.original_blob_url) {
      if (verbose)
        console.log(`   Using original blob: ${photo.original_blob_url}`)
      const response = await fetch(photo.original_blob_url)
      if (!response.ok)
        throw new Error(`Failed to fetch original: ${response.statusText}`)
      imageBuffer = Buffer.from(await response.arrayBuffer())
    } else {
      if (verbose) console.log(`   Using large.webp: ${photo.blob_url}`)
      const response = await fetch(photo.blob_url)
      if (!response.ok)
        throw new Error(`Failed to fetch: ${response.statusText}`)
      imageBuffer = Buffer.from(await response.arrayBuffer())
    }

    if (dryRun) {
      return { success: true }
    }

    const image = sharp(imageBuffer)
    const metadata = await image.metadata()
    const width = metadata.width || 0
    const height = metadata.height || 0

    // Generate thumbnails that PRESERVE ASPECT RATIO
    // Using 'inside' fit means the image is scaled to fit within the bounds
    // without cropping, allowing CSS object-fit: cover to crop at the focal point

    // 1x: max 400px on longest side
    const thumbnail = await image
      .clone()
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()

    // Upload thumbnail
    const thumbnailBlob = await put(
      `photos/${photo.id}/thumbnail.webp`,
      thumbnail,
      { access: 'public', contentType: 'image/webp', addRandomSuffix: false }
    )

    const updates: Array<{ key: string; url: string }> = [
      { key: 'thumbnail_url', url: thumbnailBlob.url },
    ]

    // 2x: max 800px (only if original is large enough)
    if (width >= 600 || height >= 600) {
      const thumbnail2x = await image
        .clone()
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer()

      const thumbnail2xBlob = await put(
        `photos/${photo.id}/thumbnail-2x.webp`,
        thumbnail2x,
        { access: 'public', contentType: 'image/webp', addRandomSuffix: false }
      )
      updates.push({ key: 'thumbnail_2x_url', url: thumbnail2xBlob.url })
    }

    // 3x: max 1200px (only if original is large enough)
    if (width >= 900 || height >= 900) {
      const thumbnail3x = await image
        .clone()
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer()

      const thumbnail3xBlob = await put(
        `photos/${photo.id}/thumbnail-3x.webp`,
        thumbnail3x,
        { access: 'public', contentType: 'image/webp', addRandomSuffix: false }
      )
      updates.push({ key: 'thumbnail_3x_url', url: thumbnail3xBlob.url })
    }

    // Update database with new thumbnail URLs
    for (const { key, url } of updates) {
      const keyPath = `{${key}}`
      await sql`
        UPDATE photos
        SET xmp_metadata = jsonb_set(
          COALESCE(xmp_metadata, '{}'::jsonb),
          ${keyPath}::text[],
          ${JSON.stringify(url)}::jsonb
        )
        WHERE id = ${photo.id}
      `
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'dry-run': { type: 'boolean' },
      verbose: { type: 'boolean' },
      limit: { type: 'string' },
      event: { type: 'string' },
      'photos-path': { type: 'string' },
    },
    allowPositionals: true,
  })

  const isDryRun = values['dry-run'] || false
  const isVerbose = values.verbose || false
  const limit = values.limit ? parseInt(values.limit as string, 10) : undefined
  const eventFilter = values.event as string | undefined
  const photosPath = values['photos-path'] as string | undefined

  // Override default photos path if provided
  if (photosPath) {
    PHOTOS_BASE_PATH = photosPath
  }

  console.log('🔄 Regenerate Thumbnails Script (Focal Point Fix)\n')
  console.log('This script regenerates thumbnails to preserve aspect ratio')
  console.log("so CSS can crop them using the photo's focal point.\n")

  if (isDryRun) {
    console.log('🧪 DRY RUN MODE - No changes will be made\n')
  }
  if (photosPath) {
    if (existsSync(photosPath)) {
      console.log(`📂 Photos path: ${photosPath} (found)\n`)
    } else {
      console.log(
        `📂 Photos path: ${photosPath} (NOT FOUND - will use blob storage)\n`
      )
    }
  }
  if (eventFilter) {
    console.log(`📁 Filtering by event: ${eventFilter}\n`)
  }
  if (limit) {
    console.log(`🔢 Processing limit: ${limit} photos\n`)
  }

  // Get photos
  console.log('💾 Fetching photos...')
  const photos = await getPhotos(eventFilter, limit)
  console.log(`   Found ${photos.length} photos\n`)

  if (photos.length === 0) {
    console.log('✅ No photos to process!')
    process.exit(0)
  }

  console.log(`🔄 Processing ${photos.length} photo(s)...\n`)

  let processed = 0
  let succeeded = 0
  let failed = 0
  const errors: Array<{ filename: string; error: string }> = []

  for (const photo of photos) {
    processed++
    const displayName = photo.original_filename || photo.id
    const progress = `[${processed}/${photos.length}]`

    if (isVerbose) {
      console.log(`${progress} Processing: ${displayName}`)
      if (photo.event_name) console.log(`   Event: ${photo.event_name}`)
      if (photo.band_name) console.log(`   Band: ${photo.band_name}`)
    } else {
      process.stdout.write(
        `\r${progress} ${displayName.slice(0, 40).padEnd(40)}`
      )
    }

    const result = await regenerateThumbnails(photo, isDryRun, isVerbose)

    if (result.success) {
      succeeded++
      if (isVerbose) console.log(`   ✅ Success\n`)
    } else {
      failed++
      errors.push({
        filename: displayName,
        error: result.error || 'Unknown error',
      })
      if (isVerbose) console.log(`   ❌ Failed: ${result.error}\n`)
    }
  }

  // Clear the progress line
  if (!isVerbose) {
    process.stdout.write('\r' + ' '.repeat(80) + '\r')
  }

  // Summary
  console.log('\n📊 Summary:')
  console.log(`   Processed: ${processed}`)
  console.log(`   Succeeded: ${succeeded}`)
  console.log(`   Failed: ${failed}`)

  if (errors.length > 0) {
    console.log('\n❌ Errors:')
    for (const { filename, error } of errors.slice(0, 10)) {
      console.log(`   ${filename}: ${error}`)
    }
    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more errors`)
    }
  }

  if (isDryRun) {
    console.log('\n🧪 DRY RUN - No actual changes were made')
  } else {
    console.log('\n✅ Done!')
  }

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
