#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

// Load environment variables from .env.local
config({ path: '.env.local' })

async function deleteEvent(eventId: string) {
  try {
    console.log(`🗑️  Deleting event: ${eventId}\n`)

    // Verify the event exists
    const { rows: events } = await sql`
      SELECT id, name FROM events WHERE id = ${eventId}
    `

    if (events.length === 0) {
      console.log(`❌ Event ${eventId} not found`)
      process.exit(1)
    }

    const event = events[0]
    console.log(`📋 Found event: ${event.name}`)

    // Count related data
    const { rows: bandCounts } = await sql`
      SELECT COUNT(*) as count FROM bands WHERE event_id = ${eventId}
    `
    const bandCount = parseInt(bandCounts[0].count)

    const { rows: voteCounts } = await sql`
      SELECT COUNT(*) as count FROM votes WHERE event_id = ${eventId}
    `
    const voteCount = parseInt(voteCounts[0].count)

    const { rows: noiseCounts } = await sql`
      SELECT COUNT(*) as count FROM crowd_noise_measurements WHERE event_id = ${eventId}
    `
    const noiseCount = parseInt(noiseCounts[0].count)

    const { rows: resultCounts } = await sql`
      SELECT COUNT(*) as count FROM finalized_results WHERE event_id = ${eventId}
    `
    const resultCount = parseInt(resultCounts[0].count)

    console.log(`\n📊 Related data to be deleted:`)
    console.log(`   - ${bandCount} bands`)
    console.log(`   - ${voteCount} votes`)
    console.log(`   - ${noiseCount} crowd noise measurements`)
    console.log(`   - ${resultCount} finalized results`)

    // Delete in order due to foreign key constraints
    // (bands, votes, crowd_noise, finalized_results cascade from event deletion)
    console.log(`\n🗑️  Deleting event and all related data...`)

    await sql`DELETE FROM events WHERE id = ${eventId}`

    console.log(`\n✅ Successfully deleted event: ${event.name}`)
    console.log(`   All related bands, votes, and results have been removed.`)
  } catch (error) {
    console.error('❌ Error deleting event:', error)
    process.exit(1)
  }
}

// Get event ID from command line arguments
const eventId = process.argv[2]

if (!eventId) {
  console.error('Usage: tsx delete-event.ts <event-id>')
  console.error('Example: tsx delete-event.ts melbourne-2024')
  process.exit(1)
}

deleteEvent(eventId)
