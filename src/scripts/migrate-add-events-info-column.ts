#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

// Load environment variables from .env.local
config({ path: '.env.local' })

async function addEventsInfoColumn() {
  try {
    console.log('🔄 Adding info JSONB column to events table...')

    // Add the info column if it doesn't exist
    await sql`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS info JSONB DEFAULT '{}'
    `

    // Create indexes for the info column
    console.log('📊 Creating JSONB indexes...')

    await sql`
      CREATE INDEX IF NOT EXISTS idx_events_info_gin 
      ON events USING GIN (info)
    `

    console.log('✅ Migration completed successfully!')
    console.log('📝 You can now store event metadata in the info JSONB column:')
    console.log('   - image_url: Event image URL')
    console.log('   - description: Event description')
    console.log('   - website: Event website')
    console.log('   - social_media: Twitter, Instagram, Facebook')
    console.log('   - venue_info: Venue details')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

addEventsInfoColumn()
