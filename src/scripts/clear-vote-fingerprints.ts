#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

// Load environment variables from .env.local
config({ path: '.env.local' })

async function clearVoteFingerprints() {
  try {
    console.log('🔄 Clearing vote fingerprints...')

    // Clear all vote fingerprints (set to NULL)
    await sql`UPDATE votes SET vote_fingerprint = NULL`

    // Clear FingerprintJS visitor IDs
    await sql`UPDATE votes SET fingerprintjs_visitor_id = NULL`

    console.log('✅ Vote fingerprints cleared!')
    console.log('📊 This will allow re-voting from the same browser/IP')
    console.log('⚠️  Note: This should only be used for testing!')
  } catch (error) {
    console.error('❌ Error clearing vote fingerprints:', error)
    process.exit(1)
  }
}

clearVoteFingerprints()
