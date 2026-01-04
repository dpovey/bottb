#!/usr/bin/env tsx

/**
 * Backfill Responsive Image Variants Script
 *
 * Generates and uploads responsive image variants (thumbnail-2x, thumbnail-3x, medium, large-4k)
 * for existing photos that don't have them yet.
 *
 * Uses original_blob_url when available for best quality, otherwise falls back to large.webp.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx src/scripts/backfill-responsive-variants.ts [options]
 *
 * Options:
 *   --dry-run            Show what would be generated without actually processing
 *   --verbose            Show detailed progress for each photo
 *   --limit <number>     Process only the first N photos (for testing)
 *   --event <name>       Only process photos from a specific event
 *   --medium-only        Only generate medium variants (for existing photos)
 *   --photos-path <path> Path to search for original photos (recursively searched)
 */

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'
import { put } from '@vercel/blob'
import { parseArgs } from 'util'
import { readFile, readdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import sharp from 'sharp'
import { processImage } from '../lib/image-processor'

// Load environment variables
config({ path: '.env.local' })

// Default photos path - can be overridden with --photos-path
let PHOTOS_BASE_PATH = '/Volumes/Extreme SSD/Photos'

interface PhotoRecord {
  id: string
  original_filename: string | null
  blob_url: string
  original_blob_url: string | null
  thumbnail_2x_url: string | null
  thumbnail_3x_url: string | null
  medium_url: string | null
  large_4k_url: string | null
  event_name?: string
  band_name?: string
}

interface BackfillResult {
  photoId: string
  filename: string
  success: boolean
  variantsGenerated: string[]
  error?: string
}

/**
 * Get photos that need responsive variants
 */
async function getPhotosNeedingVariants(
  eventName?: string,
  limit?: number,
  mediumOnly?: boolean
): Promise<PhotoRecord[]> {
  // Use separate queries for medium-only vs all variants
  if (mediumOnly) {
    return getPhotosNeedingMediumVariant(eventName, limit)
  }
  return getPhotosNeedingAllVariants(eventName, limit)
}

/**
 * Get photos that only need the medium variant
 */
async function getPhotosNeedingMediumVariant(
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
        p.xmp_metadata->>'thumbnail_2x_url' as thumbnail_2x_url,
        p.xmp_metadata->>'thumbnail_3x_url' as thumbnail_3x_url,
        p.xmp_metadata->>'medium_url' as medium_url,
        p.xmp_metadata->>'large_4k_url' as large_4k_url,
        e.name as event_name,
        b.name as band_name
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      WHERE p.xmp_metadata->>'medium_url' IS NULL
        AND e.name = ${eventName}
      LIMIT ${limit}
    `
  } else if (eventName) {
    query = sql<PhotoRecord>`
      SELECT 
        p.id,
        p.original_filename,
        p.blob_url,
        p.original_blob_url,
        p.xmp_metadata->>'thumbnail_2x_url' as thumbnail_2x_url,
        p.xmp_metadata->>'thumbnail_3x_url' as thumbnail_3x_url,
        p.xmp_metadata->>'medium_url' as medium_url,
        p.xmp_metadata->>'large_4k_url' as large_4k_url,
        e.name as event_name,
        b.name as band_name
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      WHERE p.xmp_metadata->>'medium_url' IS NULL
        AND e.name = ${eventName}
    `
  } else if (limit) {
    query = sql<PhotoRecord>`
      SELECT 
        p.id,
        p.original_filename,
        p.blob_url,
        p.original_blob_url,
        p.xmp_metadata->>'thumbnail_2x_url' as thumbnail_2x_url,
        p.xmp_metadata->>'thumbnail_3x_url' as thumbnail_3x_url,
        p.xmp_metadata->>'medium_url' as medium_url,
        p.xmp_metadata->>'large_4k_url' as large_4k_url,
        e.name as event_name,
        b.name as band_name
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      WHERE p.xmp_metadata->>'medium_url' IS NULL
      LIMIT ${limit}
    `
  } else {
    query = sql<PhotoRecord>`
      SELECT 
        p.id,
        p.original_filename,
        p.blob_url,
        p.original_blob_url,
        p.xmp_metadata->>'thumbnail_2x_url' as thumbnail_2x_url,
        p.xmp_metadata->>'thumbnail_3x_url' as thumbnail_3x_url,
        p.xmp_metadata->>'medium_url' as medium_url,
        p.xmp_metadata->>'large_4k_url' as large_4k_url,
        e.name as event_name,
        b.name as band_name
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      WHERE p.xmp_metadata->>'medium_url' IS NULL
    `
  }

  const { rows } = await query
  return rows
}

/**
 * Get photos that need any responsive variant
 */
async function getPhotosNeedingAllVariants(
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
        p.xmp_metadata->>'thumbnail_2x_url' as thumbnail_2x_url,
        p.xmp_metadata->>'thumbnail_3x_url' as thumbnail_3x_url,
        p.xmp_metadata->>'medium_url' as medium_url,
        p.xmp_metadata->>'large_4k_url' as large_4k_url,
        e.name as event_name,
        b.name as band_name
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      WHERE (
        p.xmp_metadata->>'thumbnail_2x_url' IS NULL OR
        p.xmp_metadata->>'thumbnail_3x_url' IS NULL OR
        p.xmp_metadata->>'medium_url' IS NULL OR
        p.xmp_metadata->>'large_4k_url' IS NULL
      )
        AND e.name = ${eventName}
      LIMIT ${limit}
    `
  } else if (eventName) {
    query = sql<PhotoRecord>`
      SELECT 
        p.id,
        p.original_filename,
        p.blob_url,
        p.original_blob_url,
        p.xmp_metadata->>'thumbnail_2x_url' as thumbnail_2x_url,
        p.xmp_metadata->>'thumbnail_3x_url' as thumbnail_3x_url,
        p.xmp_metadata->>'medium_url' as medium_url,
        p.xmp_metadata->>'large_4k_url' as large_4k_url,
        e.name as event_name,
        b.name as band_name
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      WHERE (
        p.xmp_metadata->>'thumbnail_2x_url' IS NULL OR
        p.xmp_metadata->>'thumbnail_3x_url' IS NULL OR
        p.xmp_metadata->>'medium_url' IS NULL OR
        p.xmp_metadata->>'large_4k_url' IS NULL
      )
        AND e.name = ${eventName}
    `
  } else if (limit) {
    query = sql<PhotoRecord>`
      SELECT 
        p.id,
        p.original_filename,
        p.blob_url,
        p.original_blob_url,
        p.xmp_metadata->>'thumbnail_2x_url' as thumbnail_2x_url,
        p.xmp_metadata->>'thumbnail_3x_url' as thumbnail_3x_url,
        p.xmp_metadata->>'medium_url' as medium_url,
        p.xmp_metadata->>'large_4k_url' as large_4k_url,
        e.name as event_name,
        b.name as band_name
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      WHERE (
        p.xmp_metadata->>'thumbnail_2x_url' IS NULL OR
        p.xmp_metadata->>'thumbnail_3x_url' IS NULL OR
        p.xmp_metadata->>'medium_url' IS NULL OR
        p.xmp_metadata->>'large_4k_url' IS NULL
      )
      LIMIT ${limit}
    `
  } else {
    query = sql<PhotoRecord>`
      SELECT 
        p.id,
        p.original_filename,
        p.blob_url,
        p.original_blob_url,
        p.xmp_metadata->>'thumbnail_2x_url' as thumbnail_2x_url,
        p.xmp_metadata->>'thumbnail_3x_url' as thumbnail_3x_url,
        p.xmp_metadata->>'medium_url' as medium_url,
        p.xmp_metadata->>'large_4k_url' as large_4k_url,
        e.name as event_name,
        b.name as band_name
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      WHERE (
        p.xmp_metadata->>'thumbnail_2x_url' IS NULL OR
        p.xmp_metadata->>'thumbnail_3x_url' IS NULL OR
        p.xmp_metadata->>'medium_url' IS NULL OR
        p.xmp_metadata->>'large_4k_url' IS NULL
      )
    `
  }

  const { rows } = await query
  return rows
}

/**
 * Find original file on disk by matching filename
 * Recursively searches PHOTOS_BASE_PATH for the file
 */
async function findOriginalFileOnDisk(
  filename: string
): Promise<string | null> {
  if (!existsSync(PHOTOS_BASE_PATH)) {
    return null
  }

  // Recursively search the entire photos directory
  return searchForFile(PHOTOS_BASE_PATH, filename)
}

/**
 * Recursively search for a file by name
 */
async function searchForFile(
  dirPath: string,
  targetFilename: string
): Promise<string | null> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      // Skip hidden files and macOS metadata files
      if (entry.name.startsWith('.') || entry.name.startsWith('._')) {
        continue
      }

      const fullPath = join(dirPath, entry.name)

      if (entry.isDirectory()) {
        const found = await searchForFile(fullPath, targetFilename)
        if (found) return found
      } else if (entry.isFile()) {
        // Match by exact filename (case-insensitive)
        if (entry.name.toLowerCase() === targetFilename.toLowerCase()) {
          // Validate it's actually an image
          try {
            const metadata = await sharp(fullPath).metadata()
            if (metadata.width && metadata.height) {
              return fullPath
            }
          } catch {
            // Not a valid image, skip
            continue
          }
        }
      }
    }
  } catch {
    // Directory might not be accessible, skip
  }

  return null
}

/**
 * Generate and upload responsive variants for a photo
 */
async function backfillVariants(
  photo: PhotoRecord,
  dryRun: boolean
): Promise<BackfillResult> {
  const variantsGenerated: string[] = []

  try {
    let imageBuffer: Buffer

    // Try to find original file on disk first
    if (photo.original_filename) {
      const localFilePath = await findOriginalFileOnDisk(
        photo.original_filename
      )

      if (localFilePath) {
        // Use original from disk (best quality)
        imageBuffer = await readFile(localFilePath)
      } else if (photo.original_blob_url) {
        // Fall back to original from blob storage
        const imageResponse = await fetch(photo.original_blob_url)
        if (!imageResponse.ok) {
          throw new Error(
            `Failed to fetch original from blob: ${imageResponse.statusText}`
          )
        }
        imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
      } else {
        // Fall back to large.webp
        const imageResponse = await fetch(photo.blob_url)
        if (!imageResponse.ok) {
          throw new Error(
            `Failed to fetch large.webp: ${imageResponse.statusText}`
          )
        }
        imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
      }
    } else if (photo.original_blob_url) {
      // Use original from blob storage
      const imageResponse = await fetch(photo.original_blob_url)
      if (!imageResponse.ok) {
        throw new Error(
          `Failed to fetch original from blob: ${imageResponse.statusText}`
        )
      }
      imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
    } else {
      // Fall back to large.webp
      const imageResponse = await fetch(photo.blob_url)
      if (!imageResponse.ok) {
        throw new Error(
          `Failed to fetch large.webp: ${imageResponse.statusText}`
        )
      }
      imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
    }

    if (dryRun) {
      return {
        photoId: photo.id,
        filename: photo.original_filename || photo.id,
        success: true,
        variantsGenerated: [
          'thumbnail-2x',
          'thumbnail-3x',
          'medium',
          'large-4k',
        ],
      }
    }

    // Process image to generate variants
    const processed = await processImage(imageBuffer)

    // Upload missing variants
    const updates: Array<{ key: string; url: string }> = []

    // Upload thumbnail-2x if missing and generated
    if (!photo.thumbnail_2x_url && processed.thumbnail2x) {
      const thumbnail2xBlob = await put(
        `photos/${photo.id}/thumbnail-2x.webp`,
        processed.thumbnail2x,
        {
          access: 'public',
          contentType: 'image/webp',
          addRandomSuffix: false,
          allowOverwrite: true,
        }
      )
      updates.push({ key: 'thumbnail_2x_url', url: thumbnail2xBlob.url })
      variantsGenerated.push('thumbnail-2x')
    }

    // Upload thumbnail-3x if missing and generated
    if (!photo.thumbnail_3x_url && processed.thumbnail3x) {
      const thumbnail3xBlob = await put(
        `photos/${photo.id}/thumbnail-3x.webp`,
        processed.thumbnail3x,
        {
          access: 'public',
          contentType: 'image/webp',
          addRandomSuffix: false,
          allowOverwrite: true,
        }
      )
      updates.push({ key: 'thumbnail_3x_url', url: thumbnail3xBlob.url })
      variantsGenerated.push('thumbnail-3x')
    }

    // Upload medium if missing and generated (for mobile slideshow)
    if (!photo.medium_url && processed.medium) {
      const mediumBlob = await put(
        `photos/${photo.id}/medium.webp`,
        processed.medium,
        {
          access: 'public',
          contentType: 'image/webp',
          addRandomSuffix: false,
          allowOverwrite: true,
        }
      )
      updates.push({ key: 'medium_url', url: mediumBlob.url })
      variantsGenerated.push('medium')
    }

    // Upload large-4k if missing and generated
    if (!photo.large_4k_url && processed.large4k) {
      const large4kBlob = await put(
        `photos/${photo.id}/large-4k.webp`,
        processed.large4k,
        {
          access: 'public',
          contentType: 'image/webp',
          addRandomSuffix: false,
          allowOverwrite: true,
        }
      )
      updates.push({ key: 'large_4k_url', url: large4kBlob.url })
      variantsGenerated.push('large-4k')
    }

    // Update database with new variant URLs
    if (updates.length > 0) {
      // Update xmp_metadata with new variant URLs (one at a time)
      // jsonb_set requires the key path as an array
      for (const { key, url } of updates) {
        // Convert key to array format for jsonb_set: 'thumbnail_2x_url' -> ['thumbnail_2x_url']
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
    }

    return {
      photoId: photo.id,
      filename: photo.original_filename || photo.id,
      success: true,
      variantsGenerated,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      photoId: photo.id,
      filename: photo.original_filename || photo.id,
      success: false,
      variantsGenerated: [],
      error: message,
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
      'medium-only': { type: 'boolean' },
      'photos-path': { type: 'string' },
      force: { type: 'boolean' },
    },
    allowPositionals: true,
  })

  const isDryRun = values['dry-run'] || false
  const isVerbose = values.verbose || false
  const mediumOnly = values['medium-only'] || false
  const forceRegenerate = values.force || false
  const limit = values.limit ? parseInt(values.limit as string, 10) : undefined
  const eventFilter = values.event as string | undefined
  const photosPath = values['photos-path'] as string | undefined

  // Override default photos path if provided
  if (photosPath) {
    PHOTOS_BASE_PATH = photosPath
  }

  console.log('🔄 Backfill Responsive Image Variants Script\n')
  if (isDryRun) {
    console.log('🧪 DRY RUN MODE - No variants will be generated or uploaded\n')
  }
  if (forceRegenerate) {
    console.log(
      '⚠️  FORCE MODE - Regenerating ALL thumbnails (for focal point fix)\n'
    )
  }
  if (mediumOnly) {
    console.log(
      '📱 MEDIUM-ONLY MODE - Only generating medium (1200px) variants\n'
    )
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

  // Get photos that need variants
  console.log('💾 Fetching photos that need responsive variants...')
  const photos = await getPhotosNeedingVariants(eventFilter, limit, mediumOnly)
  console.log(`   Found ${photos.length} photos needing variants\n`)

  if (photos.length === 0) {
    console.log('✅ All photos already have responsive variants!')
    process.exit(0)
  }

  // Count what's missing
  const missing2x = photos.filter((p) => !p.thumbnail_2x_url).length
  const missing3x = photos.filter((p) => !p.thumbnail_3x_url).length
  const missingMedium = photos.filter((p) => !p.medium_url).length
  const missing4k = photos.filter((p) => !p.large_4k_url).length

  console.log('📊 Missing variants:')
  console.log(`   thumbnail-2x: ${missing2x}`)
  console.log(`   thumbnail-3x: ${missing3x}`)
  console.log(`   medium (1200px): ${missingMedium}`)
  console.log(`   large-4k: ${missing4k}\n`)

  console.log(`🔄 Processing ${photos.length} photo(s)...\n`)

  let processed = 0
  let succeeded = 0
  let failed = 0
  const errors: Array<{ filename: string; error: string }> = []

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]

    if (!isVerbose && (i + 1) % 10 === 0) {
      console.log(`   Progress: ${i + 1}/${photos.length}...`)
    }

    if (isVerbose) {
      console.log(
        `[${i + 1}/${photos.length}] ${photo.original_filename || photo.id}`
      )
      if (photo.event_name) {
        console.log(`   Event: ${photo.event_name}`)
      }
      if (photo.band_name) {
        console.log(`   Band: ${photo.band_name}`)
      }
      const missing = []
      if (!photo.thumbnail_2x_url) missing.push('2x')
      if (!photo.thumbnail_3x_url) missing.push('3x')
      if (!photo.medium_url) missing.push('medium')
      if (!photo.large_4k_url) missing.push('4k')
      console.log(`   Missing: ${missing.join(', ') || 'none'}`)
    }

    const result = await backfillVariants(photo, isDryRun)

    processed++

    if (result.success) {
      succeeded++
      if (isVerbose) {
        const sourceInfo = photo.original_filename
          ? (await findOriginalFileOnDisk(photo.original_filename))
            ? 'local original'
            : 'blob'
          : 'blob'
        console.log(`   Source: ${sourceInfo}`)
        console.log(
          `   ✅ Generated: ${result.variantsGenerated.join(', ') || 'none needed'}`
        )
      }
    } else {
      failed++
      errors.push({
        filename: result.filename,
        error: result.error || 'Unknown error',
      })
      if (isVerbose) {
        console.log(`   ❌ Failed: ${result.error}`)
      }
    }

    if (isVerbose) {
      console.log('')
    }
  }

  // Summary
  console.log('\n📊 Summary:')
  console.log(`   Total photos: ${photos.length}`)
  console.log(`   Processed: ${processed}`)
  console.log(`   Succeeded: ${succeeded}`)
  console.log(`   Failed: ${failed}`)

  if (errors.length > 0) {
    console.log('\n❌ Errors:')
    for (const { filename, error } of errors.slice(0, 10)) {
      console.log(`   ${filename}: ${error}`)
    }
    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more`)
    }
  }

  if (isDryRun) {
    console.log(
      '\n💡 Run without --dry-run to actually generate and upload variants'
    )
  } else {
    console.log('\n✅ Done!')
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
