#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

// Load environment variables from .env.local
config({ path: '.env.local' })

async function migrateAddCrowdNoiseTable() {
  try {
    console.log('🔄 Adding crowd noise measurements table...')

    // Create the crowd noise measurements table
    await sql.query(`
      CREATE TABLE IF NOT EXISTS crowd_noise_measurements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
        energy_level DECIMAL(10,4) NOT NULL CHECK (energy_level >= 0),
        peak_volume DECIMAL(10,4) NOT NULL CHECK (peak_volume >= 0),
        recording_duration INTEGER NOT NULL CHECK (recording_duration > 0),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(event_id, band_id)
      )
    `)

    // Create indexes
    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_crowd_noise_event_id ON crowd_noise_measurements(event_id)
    `)

    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_crowd_noise_band_id ON crowd_noise_measurements(band_id)
    `)

    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_crowd_noise_created_at ON crowd_noise_measurements(created_at)
    `)

    console.log('✅ Crowd noise measurements table created successfully!')
  } catch (error) {
    console.error('❌ Error creating crowd noise measurements table:', error)
    process.exit(1)
  }
}

migrateAddCrowdNoiseTable()
