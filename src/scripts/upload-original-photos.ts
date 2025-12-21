#!/usr/bin/env tsx

/**
 * Upload Original Photos Script
 *
 * Matches original image files from external drive to existing database photos
 * by filename and uploads them to blob storage as originals.
 *
 * This preserves all existing metadata matching - we just add the original_blob_url.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx src/scripts/upload-original-photos.ts [options]
 *
 * Options:
 *   --dry-run          Show what would be uploaded without actually uploading
 *   --verbose          Show detailed progress for each file
 *   --event <name>     Only process photos from a specific event directory (e.g., "Brisbane 2024")
 */

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'
import { put } from '@vercel/blob'
import { readFile, readdir, stat } from 'fs/promises'
import { join, basename, extname } from 'path'
import { existsSync } from 'fs'
import { parseArgs } from 'util'
import sharp from 'sharp'

// Load environment variables
config({ path: '.env.local' })

const PHOTOS_BASE_PATH = '/Volumes/Extreme SSD/Photos'

interface PhotoRecord {
  id: string
  original_filename: string | null
  original_blob_url: string | null
  event_id: string | null
  event_name?: string
  band_name?: string
}

interface MatchResult {
  photoId: string
  filename: string
  filePath: string
  alreadyHasOriginal: boolean
  eventName?: string
  bandName?: string
}

/**
 * Check if a file is a valid image by trying to read its metadata
 */
async function isValidImage(filePath: string): Promise<boolean> {
  try {
    // Try to read image metadata with sharp
    // This will fail for videos, corrupted files, or non-image files
    const metadata = await sharp(filePath).metadata()
    // Check that it has valid dimensions
    return !!(
      metadata.width &&
      metadata.height &&
      metadata.width > 0 &&
      metadata.height > 0
    )
  } catch (error) {
    // Not a valid image file
    return false
  }
}

/**
 * Recursively find all valid image files in a directory
 */
async function findImageFiles(
  dirPath: string,
  recursive: boolean = true,
  validateImages: boolean = true
): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    // Skip hidden files and macOS metadata files
    if (entry.name.startsWith('.') || entry.name.startsWith('._')) {
      continue
    }

    const fullPath = join(dirPath, entry.name)

    if (entry.isDirectory() && recursive) {
      const subFiles = await findImageFiles(fullPath, recursive, validateImages)
      files.push(...subFiles)
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase()
      // Only check files with image extensions
      const imageExtensions = [
        '.jpg',
        '.jpeg',
        '.png',
        '.tiff',
        '.tif',
        '.raw',
        '.cr2',
        '.nef',
        '.arw',
        '.dng',
      ]
      if (imageExtensions.includes(ext)) {
        // Validate that it's actually an image (not a video or other file with wrong extension)
        if (validateImages) {
          const isValid = await isValidImage(fullPath)
          if (isValid) {
            files.push(fullPath)
          }
        } else {
          files.push(fullPath)
        }
      }
    }
  }

  return files
}

/**
 * Get all photos from database that don't have originals yet
 */
async function getPhotosWithoutOriginals(
  eventName?: string
): Promise<PhotoRecord[]> {
  let query = sql<PhotoRecord>`
    SELECT 
      p.id,
      p.original_filename,
      p.original_blob_url,
      p.event_id,
      e.name as event_name,
      b.name as band_name
    FROM photos p
    LEFT JOIN events e ON p.event_id = e.id
    LEFT JOIN bands b ON p.band_id = b.id
    WHERE p.original_filename IS NOT NULL
  `

  if (eventName) {
    query = sql<PhotoRecord>`
      SELECT 
        p.id,
        p.original_filename,
        p.original_blob_url,
        p.event_id,
        e.name as event_name,
        b.name as band_name
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      WHERE p.original_filename IS NOT NULL
        AND e.name = ${eventName}
    `
  }

  const { rows } = await query
  return rows
}

/**
 * Match files to database photos by filename
 */
async function matchFilesToPhotos(
  filePaths: string[],
  photos: PhotoRecord[]
): Promise<MatchResult[]> {
  const matches: MatchResult[] = []

  // Create a map of filename -> photo for quick lookup
  const photoMap = new Map<string, PhotoRecord[]>()
  for (const photo of photos) {
    if (!photo.original_filename) continue
    const filename = photo.original_filename.toLowerCase()
    if (!photoMap.has(filename)) {
      photoMap.set(filename, [])
    }
    photoMap.get(filename)!.push(photo)
  }

  for (const filePath of filePaths) {
    const filename = basename(filePath)
    const filenameLower = filename.toLowerCase()

    // Try exact match first
    const matchingPhotos = photoMap.get(filenameLower) || []

    if (matchingPhotos.length === 0) {
      // Try without extension (in case of case differences)
      const nameWithoutExt = filenameLower.replace(/\.[^.]+$/, '')
      for (const [key, photos] of photoMap.entries()) {
        const keyWithoutExt = key.replace(/\.[^.]+$/, '')
        if (keyWithoutExt === nameWithoutExt) {
          matchingPhotos.push(...photos)
          break
        }
      }
    }

    if (matchingPhotos.length > 0) {
      // Use the first match (or prefer one without original_blob_url)
      const photo =
        matchingPhotos.find((p) => !p.original_blob_url) || matchingPhotos[0]

      matches.push({
        photoId: photo.id,
        filename,
        filePath,
        alreadyHasOriginal: !!photo.original_blob_url,
        eventName: photo.event_name,
        bandName: photo.band_name,
      })
    }
  }

  return matches
}

/**
 * Upload original file to blob storage and update database
 */
async function uploadOriginal(
  photoId: string,
  filePath: string,
  filename: string,
  dryRun: boolean
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Read the file
    const fileBuffer = await readFile(filePath)
    const ext = extname(filename).toLowerCase()

    // Determine content type
    const contentTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff',
      '.raw': 'image/x-raw',
      '.cr2': 'image/x-canon-cr2',
      '.nef': 'image/x-nikon-nef',
    }
    const contentType = contentTypes[ext] || 'image/jpeg'

    if (dryRun) {
      return { success: true }
    }

    // Upload to blob storage
    const originalBlob = await put(
      `photos/${photoId}/original${ext}`,
      fileBuffer,
      {
        access: 'public',
        contentType,
        addRandomSuffix: false,
      }
    )

    // Update database
    await sql`
      UPDATE photos 
      SET original_blob_url = ${originalBlob.url}
      WHERE id = ${photoId}
    `

    return { success: true, url: originalBlob.url }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'dry-run': { type: 'boolean' },
      verbose: { type: 'boolean' },
      event: { type: 'string' },
    },
    allowPositionals: true,
  })

  const isDryRun = values['dry-run'] || false
  const isVerbose = values.verbose || false
  const eventFilter = values.event as string | undefined

  console.log('🔍 Upload Original Photos Script\n')
  if (isDryRun) {
    console.log('🧪 DRY RUN MODE - No files will be uploaded\n')
  }
  if (eventFilter) {
    console.log(`📁 Filtering by event: ${eventFilter}\n`)
  }

  // Check if base path exists
  if (!existsSync(PHOTOS_BASE_PATH)) {
    console.error(`❌ Photos directory not found: ${PHOTOS_BASE_PATH}`)
    console.error('   Make sure the external drive is mounted')
    process.exit(1)
  }

  // Get event directories to scan
  const eventDirs: string[] = []
  if (eventFilter) {
    const eventPath = join(PHOTOS_BASE_PATH, eventFilter)
    if (!existsSync(eventPath)) {
      console.error(`❌ Event directory not found: ${eventPath}`)
      process.exit(1)
    }
    eventDirs.push(eventPath)
  } else {
    // Scan for event directories (Brisbane 2024, Brisbane 2025, Sydney 2025, etc.)
    const entries = await readdir(PHOTOS_BASE_PATH, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        // Skip non-event directories
        if (['Post', 'Socials'].includes(entry.name)) {
          continue
        }
        eventDirs.push(join(PHOTOS_BASE_PATH, entry.name))
      }
    }
  }

  console.log(`📂 Scanning ${eventDirs.length} event directory(ies)...\n`)

  // Find all image files (with validation to skip videos and invalid files)
  console.log('🔍 Validating image files (this may take a moment)...\n')
  let allFiles: string[] = []
  for (const eventDir of eventDirs) {
    if (isVerbose) {
      console.log(`   Scanning: ${eventDir}`)
    }
    const files = await findImageFiles(eventDir, true, true) // Validate images
    allFiles.push(...files)
    if (isVerbose) {
      console.log(`   Found ${files.length} valid image files`)
    }
  }

  console.log(`📸 Found ${allFiles.length} image files total\n`)

  // Get photos from database
  console.log('💾 Fetching photos from database...')
  const photos = await getPhotosWithoutOriginals(eventFilter)
  console.log(`   Found ${photos.length} photos in database\n`)

  // Match files to photos
  console.log('🔗 Matching files to database photos...')
  const matches = await matchFilesToPhotos(allFiles, photos)
  console.log(`   Matched ${matches.length} files\n`)

  // Filter out ones that already have originals (unless verbose)
  const toUpload = matches.filter((m) => !m.alreadyHasOriginal || isVerbose)
  const alreadyHaveOriginal = matches.filter((m) => m.alreadyHasOriginal)

  if (alreadyHaveOriginal.length > 0) {
    console.log(
      `⚠️  ${alreadyHaveOriginal.length} photos already have originals (skipping)\n`
    )
  }

  if (toUpload.length === 0) {
    console.log('✅ No files to upload!')
    process.exit(0)
  }

  console.log(`📤 Uploading ${toUpload.length} original file(s)...\n`)

  let uploaded = 0
  let skipped = 0
  let failed = 0
  const errors: Array<{ filename: string; error: string }> = []

  for (let i = 0; i < toUpload.length; i++) {
    const match = toUpload[i]

    if (match.alreadyHasOriginal) {
      if (isVerbose) {
        console.log(
          `[${i + 1}/${toUpload.length}] ⏭️  ${match.filename} (already has original)`
        )
      }
      skipped++
      continue
    }

    if (!isVerbose && (i + 1) % 10 === 0) {
      console.log(`   Progress: ${i + 1}/${toUpload.length}...`)
    }

    if (isVerbose) {
      console.log(`[${i + 1}/${toUpload.length}] ${match.filename}`)
      if (match.eventName) {
        console.log(`   Event: ${match.eventName}`)
      }
      if (match.bandName) {
        console.log(`   Band: ${match.bandName}`)
      }
    }

    const result = await uploadOriginal(
      match.photoId,
      match.filePath,
      match.filename,
      isDryRun
    )

    if (result.success) {
      uploaded++
      if (isVerbose) {
        console.log(`   ✅ Uploaded${isDryRun ? ' (dry run)' : ''}`)
        if (result.url) {
          console.log(`   URL: ${result.url}`)
        }
      }
    } else {
      failed++
      errors.push({
        filename: match.filename,
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
  console.log(`   Total files found: ${allFiles.length}`)
  console.log(`   Matched to photos: ${matches.length}`)
  console.log(`   Uploaded: ${uploaded}`)
  console.log(`   Skipped (already have original): ${skipped}`)
  console.log(`   Failed: ${failed}`)

  if (errors.length > 0) {
    console.log('\n❌ Errors:')
    for (const { filename, error } of errors) {
      console.log(`   ${filename}: ${error}`)
    }
  }

  if (isDryRun) {
    console.log('\n💡 Run without --dry-run to actually upload files')
  } else {
    console.log('\n✅ Done!')
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
