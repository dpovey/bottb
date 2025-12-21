#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

// Load environment variables from .env.local
config({ path: '.env.local' })

async function addInfoColumn() {
  try {
    console.log('🔄 Adding info JSONB column to bands table...')

    // Add the info column if it doesn't exist
    await sql`
      ALTER TABLE bands 
      ADD COLUMN IF NOT EXISTS info JSONB DEFAULT '{}'
    `

    // Create indexes for the info column
    console.log('📊 Creating JSONB indexes...')

    await sql`
      CREATE INDEX IF NOT EXISTS idx_bands_info_gin 
      ON bands USING GIN (info)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_bands_info_logo 
      ON bands USING GIN ((info->>'logo_url'))
    `

    console.log('✅ Migration completed successfully!')
    console.log('📝 You can now store band metadata in the info JSONB column:')
    console.log('   - logo_url: Band logo URL')
    console.log('   - website: Band website')
    console.log('   - social_media: Twitter, Instagram, Facebook')
    console.log('   - genre: Music genre')
    console.log('   - members: Array of member names')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

addInfoColumn()
