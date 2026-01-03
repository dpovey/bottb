#!/usr/bin/env tsx

/**
 * Backfill Photo Slugs Script
 *
 * Generates SEO-friendly slugs for all photos that don't have them yet.
 * Processes photos in order of uploaded_at to ensure consistent sequence numbering.
 *
 * Slug format hierarchy:
 * 1. band + event: {band-slug}-{event-slug}-{n}
 * 2. event only:   {event-slug}-{n}
 * 3. band only:    {band-slug}-{n}
 * 4. photographer: {photographer-slug}-{n}
 * 5. fallback:     photo-{n}
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx src/scripts/backfill-photo-slugs.ts [options]
 *
 * Options:
 *   --dry-run        Show what slugs would be generated without saving
 *   --verbose        Show each photo as it's processed
 *   --limit <n>      Process only the first N photos
 *   --batch <n>      Process in batches of N photos (default: 100)
 */

import { config } from 'dotenv'
import { parseArgs } from 'util'

// Load environment variables
config({ path: '.env.local' })

// Import after dotenv config to ensure DB connection works
import { sql } from '@vercel/postgres'
import { slugify } from '../lib/utils'

interface PhotoRecord {
  id: string
  band_id: string | null
  band_name: string | null
  event_id: string | null
  event_name: string | null
  photographer: string | null
  uploaded_at: string
}

interface BackfillOptions {
  dryRun: boolean
  verbose: boolean
  limit?: number
  batchSize: number
}

/**
 * Build the slug prefix based on photo attribution
 */
function buildSlugPrefix(photo: PhotoRecord): string {
  // Priority 1: Band + Event (most SEO value)
  if (photo.band_name && photo.event_name) {
    const bandSlug = slugify(photo.band_name)
    const eventSlug = slugify(photo.event_name)
    return `${bandSlug}-${eventSlug}`
  }

  // Priority 2: Event only
  if (photo.event_name) {
    return slugify(photo.event_name)
  }

  // Priority 3: Band only
  if (photo.band_name) {
    return slugify(photo.band_name)
  }

  // Priority 4: Photographer
  if (photo.photographer) {
    return slugify(photo.photographer)
  }

  // Priority 5: Fallback
  return 'photo'
}

/**
 * Get the next sequence number for a given prefix
 */
async function getNextSequence(
  prefix: string,
  sequenceMap: Map<string, number>
): Promise<number> {
  // Check in-memory map first (for dry-run and efficiency)
  if (sequenceMap.has(prefix)) {
    const next = sequenceMap.get(prefix)! + 1
    sequenceMap.set(prefix, next)
    return next
  }

  // Query database for current max
  const { rows } = await sql<{ max_seq: number | null }>`
    SELECT MAX(
      CAST(
        SUBSTRING(slug FROM LENGTH(${prefix}) + 2) AS INTEGER
      )
    ) as max_seq
    FROM photos
    WHERE slug_prefix = ${prefix}
  `

  const maxSeq = rows[0]?.max_seq || 0
  const next = maxSeq + 1
  sequenceMap.set(prefix, next)
  return next
}

/**
 * Get count of photos without slugs
 */
async function getPhotosWithoutSlugCount(): Promise<number> {
  const { rows } = await sql<{ count: string }>`
    SELECT COUNT(*) as count FROM photos WHERE slug IS NULL
  `
  return parseInt(rows[0]?.count || '0', 10)
}

/**
 * Get batch of photos without slugs
 */
async function getPhotosWithoutSlugs(
  limit: number,
  offset: number
): Promise<PhotoRecord[]> {
  const { rows } = await sql<PhotoRecord>`
    SELECT p.id, p.band_id, p.event_id, p.photographer, p.uploaded_at,
           b.name as band_name, e.name as event_name
    FROM photos p
    LEFT JOIN bands b ON p.band_id = b.id
    LEFT JOIN events e ON p.event_id = e.id
    WHERE p.slug IS NULL
    ORDER BY p.uploaded_at ASC
    LIMIT ${limit} OFFSET ${offset}
  `
  return rows
}

/**
 * Save slug to database
 */
async function saveSlug(
  photoId: string,
  slug: string,
  prefix: string
): Promise<void> {
  await sql`
    UPDATE photos
    SET slug = ${slug}, slug_prefix = ${prefix}
    WHERE id = ${photoId}
  `
}

/**
 * Main backfill function
 */
async function backfillSlugs(options: BackfillOptions): Promise<void> {
  const { dryRun, verbose, limit, batchSize } = options

  console.log('Photo Slug Backfill')
  console.log('===================')
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`)
  console.log(`Batch size: ${batchSize}`)
  if (limit) console.log(`Limit: ${limit} photos`)
  console.log('')

  // Get total count
  const totalWithoutSlugs = await getPhotosWithoutSlugCount()
  console.log(`Photos without slugs: ${totalWithoutSlugs}`)

  if (totalWithoutSlugs === 0) {
    console.log('All photos already have slugs!')
    return
  }

  const toProcess = limit
    ? Math.min(limit, totalWithoutSlugs)
    : totalWithoutSlugs
  console.log(`Will process: ${toProcess} photos`)
  console.log('')

  // Track sequence numbers in memory for efficiency
  const sequenceMap = new Map<string, number>()

  // Track statistics
  let processed = 0
  let errors = 0
  const prefixCounts = new Map<string, number>()

  // Process in batches
  let offset = 0
  while (processed < toProcess) {
    const currentBatchSize = Math.min(batchSize, toProcess - processed)
    const photos = await getPhotosWithoutSlugs(currentBatchSize, offset)

    if (photos.length === 0) break

    for (const photo of photos) {
      try {
        const prefix = buildSlugPrefix(photo)
        const sequence = await getNextSequence(prefix, sequenceMap)
        const slug = `${prefix}-${sequence}`

        if (verbose) {
          const attribution =
            photo.band_name && photo.event_name
              ? `${photo.band_name} @ ${photo.event_name}`
              : photo.event_name ||
                photo.band_name ||
                photo.photographer ||
                'unattributed'
          console.log(`  ${photo.id} -> ${slug} (${attribution})`)
        }

        if (!dryRun) {
          await saveSlug(photo.id, slug, prefix)
        }

        // Track prefix usage
        prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1)
        processed++
      } catch (error) {
        errors++
        console.error(`  Error processing ${photo.id}:`, error)
      }
    }

    // Progress update
    const pct = Math.round((processed / toProcess) * 100)
    console.log(`Progress: ${processed}/${toProcess} (${pct}%)`)

    offset += currentBatchSize
  }

  // Summary
  console.log('')
  console.log('Summary')
  console.log('-------')
  console.log(`Processed: ${processed}`)
  console.log(`Errors: ${errors}`)
  console.log('')

  // Show prefix distribution
  console.log('Slug prefixes:')
  const sortedPrefixes = [...prefixCounts.entries()].sort((a, b) => b[1] - a[1])
  for (const [prefix, count] of sortedPrefixes.slice(0, 20)) {
    console.log(`  ${prefix}: ${count}`)
  }
  if (sortedPrefixes.length > 20) {
    console.log(`  ... and ${sortedPrefixes.length - 20} more prefixes`)
  }

  if (dryRun) {
    console.log('')
    console.log('This was a dry run. No changes were made.')
    console.log('Run without --dry-run to apply changes.')
  }
}

/**
 * Parse command line arguments and run
 */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      verbose: { type: 'boolean', short: 'v', default: false },
      limit: { type: 'string' },
      batch: { type: 'string', default: '100' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  })

  if (values.help) {
    console.log(`
Usage: npx tsx src/scripts/backfill-photo-slugs.ts [options]

Options:
  --dry-run        Show what slugs would be generated without saving
  --verbose, -v    Show each photo as it's processed
  --limit <n>      Process only the first N photos
  --batch <n>      Process in batches of N photos (default: 100)
  --help, -h       Show this help message
`)
    process.exit(0)
  }

  try {
    await backfillSlugs({
      dryRun: values['dry-run'] || false,
      verbose: values.verbose || false,
      limit: values.limit ? parseInt(values.limit, 10) : undefined,
      batchSize: parseInt(values.batch || '100', 10),
    })
    process.exit(0)
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main()
