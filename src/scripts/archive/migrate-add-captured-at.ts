/**
 * Migration: Add captured_at column to photos table
 *
 * This adds a column to store the original photo capture timestamp,
 * extracted from XMP/EXIF metadata. This enables sorting photos
 * chronologically by when they were taken (vs when they were uploaded).
 *
 * Fallback strategy for photos without date metadata:
 * 1. Use XMP date fields (CreateDate, DateCreated, DateTimeOriginal)
 * 2. Use event date if photo is linked to an event
 * 3. Last resort: use uploaded_at
 *
 * Run with: DOTENV_CONFIG_PATH=.env.local npx tsx src/scripts/migrate-add-captured-at.ts
 */

import 'dotenv/config'
import { sql } from '@vercel/postgres'

async function migrate() {
  console.log('🚀 Starting migration: Add captured_at column to photos...\n')

  try {
    // Add captured_at column
    console.log('Adding captured_at column...')
    await sql`
      ALTER TABLE photos 
      ADD COLUMN IF NOT EXISTS captured_at TIMESTAMP WITH TIME ZONE
    `
    console.log('✅ Column added\n')

    // Backfill from xmp_metadata, with event date as fallback
    console.log(
      'Backfilling captured_at from xmp_metadata (with event date fallback)...'
    )
    const result = await sql`
      UPDATE photos p
      SET captured_at = COALESCE(
        -- Try various date fields from XMP metadata
        (p.xmp_metadata->>'DateTimeOriginal')::timestamp with time zone,
        (p.xmp_metadata->>'CreateDate')::timestamp with time zone,
        (p.xmp_metadata->>'DateCreated')::timestamp with time zone,
        (p.xmp_metadata->'xmp'->>'CreateDate')::timestamp with time zone,
        (p.xmp_metadata->'photoshop'->>'DateCreated')::timestamp with time zone,
        -- Fall back to event date if photo is linked to an event
        (SELECT e.date FROM events e WHERE e.id = p.event_id),
        -- Last resort: use uploaded_at
        p.uploaded_at
      )
      WHERE p.captured_at IS NULL
    `
    console.log(`✅ Updated ${result.rowCount} photos\n`)

    // Create index for efficient date sorting
    console.log('Creating index on captured_at...')
    await sql`
      CREATE INDEX IF NOT EXISTS idx_photos_captured_at ON photos (captured_at)
    `
    console.log('✅ Index created\n')

    // Show summary
    const { rows: stats } = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(captured_at) as with_date,
        COUNT(*) FILTER (WHERE 
          p.xmp_metadata->>'CreateDate' IS NOT NULL OR 
          p.xmp_metadata->>'DateCreated' IS NOT NULL OR
          p.xmp_metadata->>'DateTimeOriginal' IS NOT NULL
        ) as from_metadata,
        COUNT(*) FILTER (WHERE 
          p.xmp_metadata->>'CreateDate' IS NULL AND 
          p.xmp_metadata->>'DateCreated' IS NULL AND
          p.xmp_metadata->>'DateTimeOriginal' IS NULL AND
          p.event_id IS NOT NULL
        ) as from_event_date
      FROM photos p
    `

    console.log('📊 Summary:')
    console.log(`   Total photos: ${stats[0].total}`)
    console.log(`   With captured_at: ${stats[0].with_date}`)
    console.log(`   From XMP metadata: ${stats[0].from_metadata}`)
    console.log(`   From event date (fallback): ${stats[0].from_event_date}`)

    console.log('\n✅ Migration complete!')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

migrate()
