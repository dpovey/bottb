#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

// Load environment variables from .env.local
config({ path: '.env.local' })

async function addEmailToVotes() {
  try {
    console.log('Adding email column to votes table...')

    // Add the email column
    await sql`
      ALTER TABLE votes 
      ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    `

    console.log('✅ Successfully added email column to votes table')

    // Optional: Add an index for email queries if needed
    await sql`
      CREATE INDEX IF NOT EXISTS idx_votes_email ON votes(email);
    `

    console.log('✅ Successfully added email index')
  } catch (error) {
    console.error('❌ Error adding email column to votes table:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

// Run the migration
addEmailToVotes()
