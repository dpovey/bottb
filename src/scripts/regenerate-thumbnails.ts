#!/usr/bin/env npx tsx
/**
 * Regenerate Thumbnails Script (with checkpointing)
 *
 * Regenerates all photo thumbnails to preserve aspect ratio.
 * Features:
 * - Checkpointing: saves progress to resume if interrupted
 * - Local caching: processes images to /tmp before uploading
 * - Batch uploads: uploads in batches for efficiency
 *
 * Usage:
 *   pnpm exec tsx src/scripts/regenerate-thumbnails.ts [options]
 *
 * Options:
 *   --dry-run         Preview what would be regenerated without making changes
 *   --limit <n>       Only process n photos
 *   --event <name>    Only process photos from this event
 *   --batch-size <n>  Number of photos to process before uploading (default: 20)
 *   --reset           Clear checkpoint and start fresh
 *   --photos-path     Path to original photos directory
 */

import { config } from 'dotenv'
import { parseArgs } from 'util'
import { readFile, writeFile, mkdir, readdir, unlink, stat } from 'fs/promises'
import { existsSync, readdirSync, statSync } from 'fs'
import { join, basename, extname } from 'path'
import sharp from 'sharp'
import { put } from '@vercel/blob'
import { sql } from '@vercel/postgres'

// Load environment variables
config({ path: '.env.local' })

// Paths
const CHECKPOINT_FILE = '/tmp/regenerate-thumbnails-checkpoint.json'
const CACHE_DIR = '/tmp/regenerate-thumbnails-cache'
let PHOTOS_BASE_PATH = '/Volumes/Extreme SSD/Google Photos'

interface PhotoRecord {
  id: string
  original_filename: string | null
  blob_url: string
  original_blob_url: string | null
  event_name: string | null
  band_name: string | null
}

interface Checkpoint {
  completedIds: string[]
  startedAt: string
  lastUpdated: string
}

interface ProcessedPhoto {
  photoId: string
  thumbnailPath: string
  thumbnail2xPath?: string
  mediumPath?: string
}

/**
 * Load checkpoint from disk
 */
async function loadCheckpoint(): Promise<Checkpoint> {
  try {
    if (existsSync(CHECKPOINT_FILE)) {
      const data = await readFile(CHECKPOINT_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch {
    // Ignore errors, return fresh checkpoint
  }
  return {
    completedIds: [],
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  }
}

/**
 * Save checkpoint to disk
 */
async function saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
  checkpoint.lastUpdated = new Date().toISOString()
  await writeFile(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2))
}

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir(): Promise<void> {
  if (!existsSync(CACHE_DIR)) {
    await mkdir(CACHE_DIR, { recursive: true })
  }
}

/**
 * Clean up cache directory
 */
async function cleanCache(): Promise<void> {
  if (existsSync(CACHE_DIR)) {
    const files = await readdir(CACHE_DIR)
    for (const file of files) {
      await unlink(join(CACHE_DIR, file))
    }
  }
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

  const baseName = filename.replace(/\.[^.]+$/, '')

  function searchDir(dir: string, depth: number): string | null {
    if (depth > 3) return null

    try {
      const entries = readdirSync(dir)

      for (const entry of entries) {
        const fullPath = join(dir, entry)
        const entryStat = statSync(fullPath)

        if (entryStat.isDirectory()) {
          const found = searchDir(fullPath, depth + 1)
          if (found) return found
        } else {
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
 * Process a photo and save to cache (no upload yet)
 */
async function processPhotoToCache(
  photo: PhotoRecord
): Promise<ProcessedPhoto | null> {
  try {
    let imageBuffer: Buffer

    // Try to find original file on disk first (best quality)
    if (photo.original_filename) {
      const localFilePath = await findOriginalFileOnDisk(
        photo.original_filename
      )

      if (localFilePath) {
        imageBuffer = await readFile(localFilePath)
      } else if (photo.original_blob_url) {
        const response = await fetch(photo.original_blob_url)
        if (!response.ok) throw new Error(`Failed to fetch original`)
        imageBuffer = Buffer.from(await response.arrayBuffer())
      } else {
        const response = await fetch(photo.blob_url)
        if (!response.ok) throw new Error(`Failed to fetch`)
        imageBuffer = Buffer.from(await response.arrayBuffer())
      }
    } else if (photo.original_blob_url) {
      const response = await fetch(photo.original_blob_url)
      if (!response.ok) throw new Error(`Failed to fetch original`)
      imageBuffer = Buffer.from(await response.arrayBuffer())
    } else {
      const response = await fetch(photo.blob_url)
      if (!response.ok) throw new Error(`Failed to fetch`)
      imageBuffer = Buffer.from(await response.arrayBuffer())
    }

    const image = sharp(imageBuffer)
    const metadata = await image.metadata()
    const width = metadata.width || 0
    const height = metadata.height || 0

    const result: ProcessedPhoto = {
      photoId: photo.id,
      thumbnailPath: join(CACHE_DIR, `${photo.id}-thumbnail.webp`),
    }

    // 1x: max 400px on longest side
    const thumbnail = await image
      .clone()
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()
    await writeFile(result.thumbnailPath, thumbnail)

    // 2x: max 800px (only if original is large enough)
    if (width >= 600 || height >= 600) {
      const thumbnail2x = await image
        .clone()
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer()
      result.thumbnail2xPath = join(CACHE_DIR, `${photo.id}-thumbnail-2x.webp`)
      await writeFile(result.thumbnail2xPath, thumbnail2x)
    }

    // Medium: max 1200px
    if (width >= 900 || height >= 900) {
      const medium = await image
        .clone()
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 90 })
        .toBuffer()
      result.mediumPath = join(CACHE_DIR, `${photo.id}-medium.webp`)
      await writeFile(result.mediumPath, medium)
    }

    return result
  } catch (error) {
    console.error(
      `   Error processing ${photo.original_filename || photo.id}: ${error}`
    )
    return null
  }
}

/**
 * Upload a batch of processed photos
 */
async function uploadBatch(
  batch: ProcessedPhoto[]
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0
  let failed = 0

  for (const processed of batch) {
    try {
      const updates: Array<{ key: string; url: string }> = []

      // Upload thumbnail
      const thumbnailData = await readFile(processed.thumbnailPath)
      const thumbnailBlob = await put(
        `photos/${processed.photoId}/thumbnail.webp`,
        thumbnailData,
        {
          access: 'public',
          contentType: 'image/webp',
          addRandomSuffix: false,
          allowOverwrite: true,
        }
      )
      updates.push({ key: 'thumbnail_url', url: thumbnailBlob.url })
      await unlink(processed.thumbnailPath)

      // Upload 2x if exists
      if (processed.thumbnail2xPath) {
        const data = await readFile(processed.thumbnail2xPath)
        const blob = await put(
          `photos/${processed.photoId}/thumbnail-2x.webp`,
          data,
          {
            access: 'public',
            contentType: 'image/webp',
            addRandomSuffix: false,
            allowOverwrite: true,
          }
        )
        updates.push({ key: 'thumbnail_2x_url', url: blob.url })
        await unlink(processed.thumbnail2xPath)
      }

      // Upload medium if exists
      if (processed.mediumPath) {
        const data = await readFile(processed.mediumPath)
        const blob = await put(
          `photos/${processed.photoId}/medium.webp`,
          data,
          {
            access: 'public',
            contentType: 'image/webp',
            addRandomSuffix: false,
            allowOverwrite: true,
          }
        )
        updates.push({ key: 'medium_url', url: blob.url })
        await unlink(processed.mediumPath)
      }

      // Update database
      for (const { key, url } of updates) {
        const keyPath = `{${key}}`
        await sql`
          UPDATE photos
          SET xmp_metadata = jsonb_set(
            COALESCE(xmp_metadata, '{}'::jsonb),
            ${keyPath}::text[],
            ${JSON.stringify(url)}::jsonb
          )
          WHERE id = ${processed.photoId}
        `
      }

      succeeded++
    } catch (error) {
      console.error(`   Upload failed for ${processed.photoId}: ${error}`)
      failed++
    }
  }

  return { succeeded, failed }
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'dry-run': { type: 'boolean' },
      limit: { type: 'string' },
      event: { type: 'string' },
      'batch-size': { type: 'string' },
      reset: { type: 'boolean' },
      'photos-path': { type: 'string' },
    },
    allowPositionals: true,
  })

  const isDryRun = values['dry-run'] || false
  const limit = values.limit ? parseInt(values.limit as string, 10) : undefined
  const eventFilter = values.event as string | undefined
  const batchSize = values['batch-size']
    ? parseInt(values['batch-size'] as string, 10)
    : 20
  const resetCheckpoint = values.reset || false
  const photosPath = values['photos-path'] as string | undefined

  if (photosPath) {
    PHOTOS_BASE_PATH = photosPath
  }

  console.log('🔄 Regenerate Thumbnails Script (with checkpointing)\n')

  if (isDryRun) {
    console.log('🧪 DRY RUN MODE - No changes will be made\n')
  }

  // Load or reset checkpoint
  let checkpoint: Checkpoint
  if (resetCheckpoint) {
    checkpoint = {
      completedIds: [],
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    }
    console.log('🔄 Checkpoint reset\n')
  } else {
    checkpoint = await loadCheckpoint()
    if (checkpoint.completedIds.length > 0) {
      console.log(
        `📋 Resuming from checkpoint: ${checkpoint.completedIds.length} already completed\n`
      )
    }
  }

  await ensureCacheDir()

  // Get photos
  console.log('💾 Fetching photos...')
  const allPhotos = await getPhotos(eventFilter, limit)

  // Filter out already completed
  const photos = allPhotos.filter(
    (p) => !checkpoint.completedIds.includes(p.id)
  )
  console.log(
    `   Found ${allPhotos.length} total, ${photos.length} remaining\n`
  )

  if (photos.length === 0) {
    console.log('✅ All photos already processed!')
    process.exit(0)
  }

  console.log(`🔄 Processing in batches of ${batchSize}...\n`)

  let totalProcessed = 0
  let totalSucceeded = 0
  let totalFailed = 0

  // Process in batches
  for (let i = 0; i < photos.length; i += batchSize) {
    const batchPhotos = photos.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(photos.length / batchSize)

    console.log(
      `📦 Batch ${batchNum}/${totalBatches} (${batchPhotos.length} photos)`
    )

    // Process photos to cache
    console.log('   Processing images...')
    const processed: ProcessedPhoto[] = []
    for (const photo of batchPhotos) {
      const result = await processPhotoToCache(photo)
      if (result) {
        processed.push(result)
      }
      totalProcessed++
    }

    if (isDryRun) {
      console.log(`   Would upload ${processed.length} photos`)
      // Mark as completed in checkpoint for dry run
      for (const photo of batchPhotos) {
        checkpoint.completedIds.push(photo.id)
      }
      await saveCheckpoint(checkpoint)
      continue
    }

    // Upload batch
    console.log(`   Uploading ${processed.length} photos...`)
    const { succeeded, failed } = await uploadBatch(processed)
    totalSucceeded += succeeded
    totalFailed += failed

    // Update checkpoint
    for (const photo of batchPhotos) {
      checkpoint.completedIds.push(photo.id)
    }
    await saveCheckpoint(checkpoint)

    console.log(`   ✅ ${succeeded} succeeded, ❌ ${failed} failed\n`)
  }

  // Clean up cache
  await cleanCache()

  // Summary
  console.log('\n📊 Summary:')
  console.log(`   Total processed: ${totalProcessed}`)
  console.log(`   Succeeded: ${totalSucceeded}`)
  console.log(`   Failed: ${totalFailed}`)
  console.log(
    `   Previously completed: ${checkpoint.completedIds.length - photos.length}`
  )

  if (isDryRun) {
    console.log('\n🧪 DRY RUN - No actual changes were made')
  } else {
    console.log('\n✅ Done!')
  }

  // Clear checkpoint on full success
  if (totalFailed === 0 && !isDryRun) {
    await unlink(CHECKPOINT_FILE).catch(() => {})
    console.log('🧹 Checkpoint cleared (all done!)')
  }

  process.exit(totalFailed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
