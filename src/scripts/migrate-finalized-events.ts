#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'
import { finalizeEventResults, hasFinalizedResults } from '../lib/db'
import { parseScoringVersion } from '../lib/scoring'

// Load environment variables from .env.local
config({ path: '.env.local' })

interface EventRow {
  id: string
  name: string
  location: string
  status: string
  info?: {
    scoring_version?: string
    winner?: string
    [key: string]: unknown
  }
}

async function migrateFinalizedEvents() {
  try {
    console.log('🔄 Migrating finalized events to finalized_results table...\n')

    // Find all finalized events
    const { rows: events } = await sql<EventRow>`
      SELECT id, name, location, status, info 
      FROM events 
      WHERE status = 'finalized'
      ORDER BY date DESC
    `

    if (events.length === 0) {
      console.log('✅ No finalized events found to migrate.')
      return
    }

    console.log(`📋 Found ${events.length} finalized event(s):\n`)

    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    for (const event of events) {
      console.log(`   Processing: ${event.name} (${event.location})`)
      console.log(`   Event ID: ${event.id}`)

      const scoringVersion = parseScoringVersion(event.info)
      console.log(`   Scoring version: ${scoringVersion}`)

      try {
        // Check if results already exist
        const hasResults = await hasFinalizedResults(event.id)

        if (hasResults) {
          console.log(`   ⏭️  Skipped - results already exist\n`)
          skipCount++
          continue
        }

        // For 2022.1 events, don't calculate scores
        if (scoringVersion === '2022.1') {
          const winner = event.info?.winner
          if (winner) {
            console.log(`   ✅ 2022.1 event - winner: ${winner}`)
            console.log(`   📝 No detailed results to store\n`)
          } else {
            console.log(`   ⚠️  2022.1 event without winner set\n`)
          }
          skipCount++
          continue
        }

        // Finalize the event results
        const results = await finalizeEventResults(event.id, scoringVersion)

        if (results.length > 0) {
          console.log(`   ✅ Created ${results.length} result entries`)
          console.log(
            `   🏆 Winner: ${results[0].band_name} (${Number(
              results[0].total_score || 0
            ).toFixed(1)} points)\n`
          )
          successCount++
        } else {
          console.log(`   ⚠️  No scores found for this event\n`)
          skipCount++
        }
      } catch (error) {
        console.error(`   ❌ Error processing event: ${error}\n`)
        errorCount++
      }
    }

    console.log('─'.repeat(50))
    console.log('\n📊 Migration Summary:')
    console.log(`   ✅ Successfully migrated: ${successCount}`)
    console.log(`   ⏭️  Skipped (already exists or 2022.1): ${skipCount}`)
    console.log(`   ❌ Errors: ${errorCount}`)
  } catch (error) {
    console.error('❌ Error during migration:', error)
    process.exit(1)
  }
}

migrateFinalizedEvents()
