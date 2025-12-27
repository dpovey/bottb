#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

// Load environment variables from .env.local
config({ path: '.env.local' })

interface EventInfo {
  scoring_version?: string
  winner?: string
  [key: string]: unknown
}

async function cleanup2022Events() {
  try {
    console.log('🧹 Cleaning up made-up scores from 2022.1 events...\n')

    // Events that use 2022.1 scoring (single winner display only)
    const eventsToClean = ['brisbane-2024', 'brisbane-2025']

    for (const eventId of eventsToClean) {
      console.log(`\n📋 Processing event: ${eventId}`)

      // Verify the event exists and has 2022.1 scoring
      const { rows: events } = await sql`
        SELECT id, name, info FROM events WHERE id = ${eventId}
      `

      if (events.length === 0) {
        console.log(`   ⚠️  Event ${eventId} not found, skipping...`)
        continue
      }

      const event = events[0]
      const eventInfo = (event.info as EventInfo) || {}

      if (eventInfo.scoring_version !== '2022.1') {
        console.log(
          `   ⚠️  Event ${eventId} is not 2022.1 (is: ${eventInfo.scoring_version || 'not set'}), skipping...`
        )
        continue
      }

      // Count existing votes
      const { rows: voteCounts } = await sql`
        SELECT COUNT(*) as count FROM votes WHERE event_id = ${eventId}
      `
      const voteCount = parseInt(voteCounts[0].count)

      if (voteCount > 0) {
        console.log(`   🗑️  Removing ${voteCount} votes from ${event.name}...`)
        await sql`DELETE FROM votes WHERE event_id = ${eventId}`
        console.log(`   ✅ Removed ${voteCount} votes`)
      } else {
        console.log(`   ✅ No votes to remove`)
      }

      // Count and remove crowd noise measurements
      const { rows: noiseCounts } = await sql`
        SELECT COUNT(*) as count FROM crowd_noise_measurements WHERE event_id = ${eventId}
      `
      const noiseCount = parseInt(noiseCounts[0].count)

      if (noiseCount > 0) {
        console.log(`   🗑️  Removing ${noiseCount} crowd noise measurements...`)
        await sql`DELETE FROM crowd_noise_measurements WHERE event_id = ${eventId}`
        console.log(`   ✅ Removed ${noiseCount} crowd noise measurements`)
      } else {
        console.log(`   ✅ No crowd noise measurements to remove`)
      }

      // Count and remove finalized results
      const { rows: resultCounts } = await sql`
        SELECT COUNT(*) as count FROM finalized_results WHERE event_id = ${eventId}
      `
      const resultCount = parseInt(resultCounts[0].count)

      if (resultCount > 0) {
        console.log(`   🗑️  Removing ${resultCount} finalized results...`)
        await sql`DELETE FROM finalized_results WHERE event_id = ${eventId}`
        console.log(`   ✅ Removed ${resultCount} finalized results`)
      } else {
        console.log(`   ✅ No finalized results to remove`)
      }

      // Verify winner is set in event info
      if (!eventInfo.winner) {
        console.log(`   ⚠️  Warning: No winner set for ${event.name}`)
      } else {
        console.log(`   🏆 Winner preserved: ${eventInfo.winner}`)
      }
    }

    console.log('\n✅ Cleanup completed successfully!')
    console.log('\n📝 2022.1 events now only have:')
    console.log('   - Event metadata with winner name')
    console.log('   - Band information')
    console.log('   - No votes, scores, or measurements')
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    process.exit(1)
  }
}

cleanup2022Events()
