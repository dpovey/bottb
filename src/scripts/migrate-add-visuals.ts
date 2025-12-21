#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

// Load environment variables from .env.local
config({ path: '.env.local' })

async function addVisualsColumn() {
  try {
    console.log('🔄 Adding visuals column to votes table...')

    // Add the visuals column if it doesn't exist
    await sql`
      ALTER TABLE votes 
      ADD COLUMN IF NOT EXISTS visuals INTEGER CHECK (visuals >= 0 AND visuals <= 20)
    `

    console.log('✅ Added visuals column to votes table')

    // Update the finalized_results table to include the new scoring category
    console.log('🔄 Adding visuals columns to finalized_results table...')

    await sql`
      ALTER TABLE finalized_results 
      ADD COLUMN IF NOT EXISTS avg_visuals DECIMAL(10,2)
    `

    await sql`
      ALTER TABLE finalized_results 
      ADD COLUMN IF NOT EXISTS visuals_score DECIMAL(10,2)
    `

    console.log('✅ Added visuals columns to finalized_results table')

    console.log('\n✅ Migration completed successfully!')
    console.log(
      '📝 The votes table now supports the 2026.1 scoring with visuals'
    )
    console.log(
      '   - visuals: Integer 0-20 (judge scoring for costumes, backdrops, visual presentation)'
    )
  } catch (error) {
    console.error('❌ Error during migration:', error)
    process.exit(1)
  }
}

addVisualsColumn()
