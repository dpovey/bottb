#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

// Load environment variables from .env.local
config({ path: '.env.local' })

async function migrateAddCrowdScore() {
  try {
    console.log(
      'Adding crowd_score column to crowd_noise_measurements table...'
    )

    // Add the crowd_score column
    await sql`
      ALTER TABLE crowd_noise_measurements 
      ADD COLUMN IF NOT EXISTS crowd_score INTEGER CHECK (crowd_score >= 1 AND crowd_score <= 10)
    `

    console.log('✅ crowd_score column added successfully')

    // Update existing records with a default score based on energy level
    console.log('Updating existing records with calculated crowd scores...')

    await sql`
      UPDATE crowd_noise_measurements 
      SET crowd_score = LEAST(10, GREATEST(1, ROUND(energy_level * 10)))
      WHERE crowd_score IS NULL
    `

    console.log('✅ Existing records updated with calculated crowd scores')

    // Make the column NOT NULL now that all records have values
    console.log('Making crowd_score column NOT NULL...')

    await sql`
      ALTER TABLE crowd_noise_measurements 
      ALTER COLUMN crowd_score SET NOT NULL
    `

    console.log('✅ crowd_score column is now NOT NULL')

    console.log('🎉 Migration completed successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

migrateAddCrowdScore()
