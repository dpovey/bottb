/**
 * Migration: Add avatar_url column to photographers table
 *
 * Adds an optional avatar_url field for photographer profile pictures.
 */

import { sql } from '@vercel/postgres'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

async function migrate() {
  console.log('🚀 Starting migration: add avatar_url to photographers...\n')

  try {
    // Check if column already exists
    const { rows: columns } = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'photographers' AND column_name = 'avatar_url'
    `

    if (columns.length > 0) {
      console.log('✅ Column avatar_url already exists. Nothing to do.')
      process.exit(0)
    }

    // Add the column
    console.log('📝 Adding avatar_url column...')
    await sql`
      ALTER TABLE photographers
      ADD COLUMN avatar_url TEXT
    `

    console.log('✅ Migration completed successfully!')
    console.log('   Added avatar_url column to photographers table.')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

migrate()
