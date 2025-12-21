#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

// Load environment variables
config({ path: '.env.local' })

interface BandRow {
  id: string
  name: string
}

// Helper function to convert name to slug
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

async function migrateRenameEvent(oldEventId: string, newEventId: string) {
  console.log(`🚀 Renaming event: ${oldEventId} → ${newEventId}\n`)

  try {
    // Check if old event exists
    const { rows: oldEvent } = await sql`
      SELECT id, name FROM events WHERE id = ${oldEventId}
    `

    if (oldEvent.length === 0) {
      console.error(`❌ Event not found: ${oldEventId}`)
      process.exit(1)
    }

    // Check if new ID already exists
    const { rows: existingEvent } = await sql`
      SELECT id FROM events WHERE id = ${newEventId}
    `

    if (existingEvent.length > 0) {
      console.error(`❌ Event ID already exists: ${newEventId}`)
      process.exit(1)
    }

    console.log(`📝 Event found: ${oldEvent[0].name}`)

    // Get all bands for this event
    const { rows: bands } = await sql<BandRow>`
      SELECT id, name FROM bands WHERE event_id = ${oldEventId}
    `

    console.log(`📝 Found ${bands.length} bands to rename\n`)

    // Calculate new band IDs
    const bandMappings = bands.map((band) => ({
      oldId: band.id,
      newId: `${nameToSlug(band.name)}-${newEventId}`,
      name: band.name,
    }))

    // Show preview
    console.log('Preview of changes:')
    console.log(`  Event: ${oldEventId} → ${newEventId}`)
    for (const mapping of bandMappings) {
      console.log(`  Band: ${mapping.oldId} → ${mapping.newId}`)
    }
    console.log('')

    // Rename bands - need to handle foreign key constraints carefully
    // Strategy: Insert new band row, update references, delete old row
    console.log('🔄 Renaming bands...')
    for (const mapping of bandMappings) {
      // Step 1: Create new band row with new ID (copy all data)
      await sql`
        INSERT INTO bands (id, event_id, name, description, "order", info, created_at)
        SELECT ${mapping.newId}, event_id, name, description, "order", info, created_at
        FROM bands WHERE id = ${mapping.oldId}
      `

      // Step 2: Update all references to point to new band ID
      await sql`
        UPDATE finalized_results 
        SET band_id = ${mapping.newId}
        WHERE band_id = ${mapping.oldId}
      `

      await sql`
        UPDATE votes 
        SET band_id = ${mapping.newId}
        WHERE band_id = ${mapping.oldId}
      `

      await sql`
        UPDATE photos 
        SET band_id = ${mapping.newId}
        WHERE band_id = ${mapping.oldId}
      `

      await sql`
        UPDATE crowd_noise_measurements 
        SET band_id = ${mapping.newId}
        WHERE band_id = ${mapping.oldId}
      `

      // Step 3: Delete old band row
      await sql`
        DELETE FROM bands WHERE id = ${mapping.oldId}
      `

      console.log(`  ✅ ${mapping.name}: ${mapping.oldId} → ${mapping.newId}`)
    }

    // Rename event - same strategy: insert new, update refs, delete old
    console.log('\n🔄 Renaming event...')

    // Step 1: Create new event row with new ID (copy all data)
    await sql`
      INSERT INTO events (id, name, date, location, is_active, status, info, created_at)
      SELECT ${newEventId}, name, date, location, is_active, status, info, created_at
      FROM events WHERE id = ${oldEventId}
    `

    // Step 2: Update all references to point to new event ID
    await sql`
      UPDATE finalized_results 
      SET event_id = ${newEventId}
      WHERE event_id = ${oldEventId}
    `

    await sql`
      UPDATE votes 
      SET event_id = ${newEventId}
      WHERE event_id = ${oldEventId}
    `

    await sql`
      UPDATE photos 
      SET event_id = ${newEventId}
      WHERE event_id = ${oldEventId}
    `

    await sql`
      UPDATE crowd_noise_measurements 
      SET event_id = ${newEventId}
      WHERE event_id = ${oldEventId}
    `

    await sql`
      UPDATE bands 
      SET event_id = ${newEventId}
      WHERE event_id = ${oldEventId}
    `

    // Step 3: Delete old event row
    await sql`
      DELETE FROM events WHERE id = ${oldEventId}
    `

    console.log(`  ✅ Event renamed: ${oldEventId} → ${newEventId}`)

    console.log('\n🎉 Migration completed successfully!')
    console.log(`\nNew event ID: ${newEventId}`)
    console.log(`Bands renamed: ${bands.length}`)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

// Get arguments
const oldEventId = process.argv[2]
const newEventId = process.argv[3]

if (!oldEventId || !newEventId) {
  console.log(`
📝 Rename Event Migration

Usage: npx tsx src/scripts/migrate-rename-event.ts <old-event-id> <new-event-id>

Example:
  npx tsx src/scripts/migrate-rename-event.ts battle-of-the-tech-bands-brisbane-2024 brisbane-2024

This will:
  1. Rename the event ID
  2. Rename all band IDs to use the new event ID
  3. Update all references in votes, photos, finalized_results, etc.
`)
  process.exit(0)
}

migrateRenameEvent(oldEventId, newEventId)
