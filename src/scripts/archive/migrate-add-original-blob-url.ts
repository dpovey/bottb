/**
 * Migration: Add original_blob_url column to photos table
 *
 * This adds a column to store the URL of the original full-resolution image.
 * When available, downloads and crop operations will use this instead of
 * the processed large.webp version (2000px max).
 *
 * Run with: DOTENV_CONFIG_PATH=.env.local npx tsx src/scripts/migrate-add-original-blob-url.ts
 */

import 'dotenv/config'
import { sql } from '@vercel/postgres'

async function migrate() {
  console.log(
    '🚀 Starting migration: Add original_blob_url column to photos...\n'
  )

  try {
    // Add original_blob_url column
    console.log('Adding original_blob_url column...')
    await sql`
      ALTER TABLE photos 
      ADD COLUMN IF NOT EXISTS original_blob_url TEXT
    `
    console.log('✅ Column added\n')

    // Create index for efficient lookups
    console.log('Creating index on original_blob_url...')
    await sql`
      CREATE INDEX IF NOT EXISTS idx_photos_original_blob_url ON photos (original_blob_url) 
      WHERE original_blob_url IS NOT NULL
    `
    console.log('✅ Index created\n')

    // Show summary
    const { rows: stats } = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(original_blob_url) as with_original
      FROM photos
    `

    console.log('📊 Summary:')
    console.log(`   Total photos: ${stats[0].total}`)
    console.log(`   With original_blob_url: ${stats[0].with_original}`)
    console.log(
      `   Without original (will use large.webp): ${stats[0].total - stats[0].with_original}`
    )

    console.log('\n✅ Migration complete!')
    console.log('\n💡 Next steps:')
    console.log(
      '   1. Run upload-original-photos.ts to match and upload originals from external drive'
    )
    console.log(
      '   2. Update download function to use original_blob_url when available'
    )
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

migrate()
