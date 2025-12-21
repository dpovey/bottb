#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

// Load environment variables from .env.local
config({ path: '.env.local' })

async function cleanupEvent(eventId: string) {
  try {
    console.log(`Cleaning up event: ${eventId}`)

    // First, get event details to confirm
    const { rows: eventRows } = await sql`
      SELECT id, name, location, date 
      FROM events 
      WHERE id = ${eventId}
    `

    if (eventRows.length === 0) {
      console.error(`❌ Event with ID ${eventId} not found`)
      process.exit(1)
    }

    const event = eventRows[0]
    console.log(`Found event: ${event.name} (${event.location})`)

    // Delete votes first (due to foreign key constraints)
    const { rowCount: votesDeleted } = await sql`
      DELETE FROM votes WHERE event_id = ${eventId}
    `
    console.log(`✅ Deleted ${votesDeleted} votes`)

    // Delete bands
    const { rowCount: bandsDeleted } = await sql`
      DELETE FROM bands WHERE event_id = ${eventId}
    `
    console.log(`✅ Deleted ${bandsDeleted} bands`)

    // Delete event
    await sql`
      DELETE FROM events WHERE id = ${eventId}
    `
    console.log(`✅ Deleted event`)

    console.log(`\n🎉 Event "${event.name}" cleaned up successfully!`)
  } catch (error) {
    console.error('❌ Error cleaning up event:', error)
    process.exit(1)
  }
}

// Get event ID from command line arguments
const eventId = process.argv[2]

if (!eventId) {
  console.error('Usage: tsx cleanup-event.ts <event-id>')
  console.error(
    'Example: tsx cleanup-event.ts 749db2c4-09e2-4e62-8ad8-0802960b4357'
  )
  process.exit(1)
}

cleanupEvent(eventId)
