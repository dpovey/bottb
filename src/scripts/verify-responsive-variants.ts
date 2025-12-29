#!/usr/bin/env tsx

/**
 * Verify Responsive Image Variants Script
 *
 * Verifies that all photos have responsive variants stored correctly:
 * - Checks database for variant URLs (thumbnail_2x_url, thumbnail_3x_url, large_4k_url)
 * - Optionally verifies blob URLs are accessible
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx src/scripts/verify-responsive-variants.ts [options]
 *
 * Options:
 *   --check-blobs     Also verify that blob URLs are accessible (slower)
 *   --event <name>    Only check photos from a specific event
 */

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'
import { parseArgs } from 'util'

// Load environment variables
config({ path: '.env.local' })

interface PhotoRecord {
  id: string
  original_filename: string | null
  thumbnail_2x_url: string | null
  thumbnail_3x_url: string | null
  large_4k_url: string | null
  event_name?: string
  band_name?: string
}

interface VerificationResult {
  photoId: string
  filename: string
  has2x: boolean
  has3x: boolean
  has4k: boolean
  blob2xAccessible?: boolean
  blob3xAccessible?: boolean
  blob4kAccessible?: boolean
}

/**
 * Get all photos with their variant URLs
 */
async function getAllPhotos(eventName?: string): Promise<PhotoRecord[]> {
  if (eventName) {
    const { rows } = await sql<PhotoRecord>`
      SELECT 
        p.id,
        p.original_filename,
        p.xmp_metadata->>'thumbnail_2x_url' as thumbnail_2x_url,
        p.xmp_metadata->>'thumbnail_3x_url' as thumbnail_3x_url,
        p.xmp_metadata->>'large_4k_url' as large_4k_url,
        e.name as event_name,
        b.name as band_name
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      WHERE e.name = ${eventName}
      ORDER BY p.uploaded_at DESC
    `
    return rows
  } else {
    const { rows } = await sql<PhotoRecord>`
      SELECT 
        p.id,
        p.original_filename,
        p.xmp_metadata->>'thumbnail_2x_url' as thumbnail_2x_url,
        p.xmp_metadata->>'thumbnail_3x_url' as thumbnail_3x_url,
        p.xmp_metadata->>'large_4k_url' as large_4k_url,
        e.name as event_name,
        b.name as band_name
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      ORDER BY p.uploaded_at DESC
    `
    return rows
  }
}

/**
 * Verify blob URL is accessible
 */
async function verifyBlobAccessible(url: string): Promise<boolean> {
  try {
    // Try HEAD first, fall back to GET if HEAD fails
    let response = await fetch(url, { method: 'HEAD' })
    if (response.ok) {
      return true
    }
    // Some blob storage doesn't support HEAD, try GET with range
    response = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' }, // Just fetch first byte
    })
    return response.ok || response.status === 206 // 206 = Partial Content
  } catch {
    return false
  }
}

/**
 * Verify a photo's variants
 */
async function verifyPhoto(
  photo: PhotoRecord,
  checkBlobs: boolean
): Promise<VerificationResult> {
  const result: VerificationResult = {
    photoId: photo.id,
    filename: photo.original_filename || photo.id,
    has2x: !!photo.thumbnail_2x_url,
    has3x: !!photo.thumbnail_3x_url,
    has4k: !!photo.large_4k_url,
  }

  if (checkBlobs) {
    if (photo.thumbnail_2x_url) {
      result.blob2xAccessible = await verifyBlobAccessible(
        photo.thumbnail_2x_url
      )
    }
    if (photo.thumbnail_3x_url) {
      result.blob3xAccessible = await verifyBlobAccessible(
        photo.thumbnail_3x_url
      )
    }
    if (photo.large_4k_url) {
      result.blob4kAccessible = await verifyBlobAccessible(photo.large_4k_url)
    }
  }

  return result
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'check-blobs': { type: 'boolean' },
      event: { type: 'string' },
    },
    allowPositionals: true,
  })

  const checkBlobs = values['check-blobs'] || false
  const eventFilter = values.event as string | undefined

  console.log('🔍 Verify Responsive Image Variants\n')
  if (eventFilter) {
    console.log(`📁 Filtering by event: ${eventFilter}\n`)
  }
  if (checkBlobs) {
    console.log(
      '🌐 Will verify blob URLs are accessible (this may take a while)\n'
    )
  }

  // Get all photos
  console.log('💾 Fetching photos from database...')
  const photos = await getAllPhotos(eventFilter)
  console.log(`   Found ${photos.length} photos\n`)

  if (photos.length === 0) {
    console.log('❌ No photos found!')
    process.exit(1)
  }

  console.log('🔍 Verifying variants...\n')

  const results: VerificationResult[] = []

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]

    if ((i + 1) % 100 === 0) {
      console.log(`   Progress: ${i + 1}/${photos.length}...`)
    }

    const result = await verifyPhoto(photo, checkBlobs)
    results.push(result)
  }

  // Analyze results
  const total = results.length
  const hasAllVariants = results.filter(
    (r) => r.has2x && r.has3x && r.has4k
  ).length
  const missing2x = results.filter((r) => !r.has2x).length
  const missing3x = results.filter((r) => !r.has3x).length
  const missing4k = results.filter((r) => !r.has4k).length

  // Blob accessibility (if checked)
  let inaccessible2x = 0
  let inaccessible3x = 0
  let inaccessible4k = 0

  if (checkBlobs) {
    inaccessible2x = results.filter(
      (r) => r.has2x && r.blob2xAccessible === false
    ).length
    inaccessible3x = results.filter(
      (r) => r.has3x && r.blob3xAccessible === false
    ).length
    inaccessible4k = results.filter(
      (r) => r.has4k && r.blob4kAccessible === false
    ).length
  }

  // Summary
  console.log('\n📊 Summary:')
  console.log(`   Total photos: ${total}`)
  console.log(
    `   Photos with all variants: ${hasAllVariants} (${((hasAllVariants / total) * 100).toFixed(1)}%)`
  )
  console.log(`   Missing thumbnail-2x: ${missing2x}`)
  console.log(`   Missing thumbnail-3x: ${missing3x}`)
  console.log(`   Missing large-4k: ${missing4k}`)

  if (checkBlobs) {
    console.log('\n🌐 Blob Accessibility:')
    if (inaccessible2x > 0) {
      console.log(`   ⚠️  Inaccessible thumbnail-2x URLs: ${inaccessible2x}`)
    }
    if (inaccessible3x > 0) {
      console.log(`   ⚠️  Inaccessible thumbnail-3x URLs: ${inaccessible3x}`)
    }
    if (inaccessible4k > 0) {
      console.log(`   ⚠️  Inaccessible large-4k URLs: ${inaccessible4k}`)
    }
    if (inaccessible2x === 0 && inaccessible3x === 0 && inaccessible4k === 0) {
      console.log('   ✅ All blob URLs are accessible')
    }
  }

  // Show photos missing variants
  const missingVariants = results.filter(
    (r) => !r.has2x || !r.has3x || !r.has4k
  )

  if (missingVariants.length > 0) {
    console.log(`\n⚠️  Photos missing variants (${missingVariants.length}):`)
    for (const result of missingVariants.slice(0, 20)) {
      const missing = []
      if (!result.has2x) missing.push('2x')
      if (!result.has3x) missing.push('3x')
      if (!result.has4k) missing.push('4k')
      console.log(`   ${result.filename}: missing ${missing.join(', ')}`)
    }
    if (missingVariants.length > 20) {
      console.log(`   ... and ${missingVariants.length - 20} more`)
    }
  }

  // Show inaccessible blobs (if checked)
  if (checkBlobs) {
    const inaccessible = results.filter(
      (r) =>
        (r.has2x && r.blob2xAccessible === false) ||
        (r.has3x && r.blob3xAccessible === false) ||
        (r.has4k && r.blob4kAccessible === false)
    )

    if (inaccessible.length > 0) {
      console.log(
        `\n❌ Photos with inaccessible blob URLs (${inaccessible.length}):`
      )
      for (const result of inaccessible.slice(0, 20)) {
        const issues = []
        if (result.has2x && result.blob2xAccessible === false) issues.push('2x')
        if (result.has3x && result.blob3xAccessible === false) issues.push('3x')
        if (result.has4k && result.blob4kAccessible === false) issues.push('4k')
        console.log(`   ${result.filename}: inaccessible ${issues.join(', ')}`)
      }
      if (inaccessible.length > 20) {
        console.log(`   ... and ${inaccessible.length - 20} more`)
      }
    }
  }

  // Final status
  const allGood =
    missing2x === 0 &&
    missing3x === 0 &&
    missing4k === 0 &&
    (!checkBlobs ||
      (inaccessible2x === 0 && inaccessible3x === 0 && inaccessible4k === 0))

  if (allGood) {
    console.log('\n✅ All photos have responsive variants!')
    if (checkBlobs) {
      console.log('✅ All blob URLs are accessible!')
    }
  } else {
    console.log(
      '\n⚠️  Some photos are missing variants or have inaccessible URLs'
    )
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
