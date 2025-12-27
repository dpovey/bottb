#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

// Load environment variables from .env.local
config({ path: '.env.local' })

// Helper function to convert name to slug
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim()
}

// Helper function to generate band slug
function generateBandSlug(bandName: string, eventName: string): string {
  const bandSlug = nameToSlug(bandName)
  const eventSlug = nameToSlug(eventName)
  return `${bandSlug}-${eventSlug}`
}

async function migrateUuidToSlugs() {
  try {
    console.log('🚀 Starting UUID to slug migration...\n')

    // Step 1: Add slug columns
    console.log('1. Adding slug columns...')
    await sql`ALTER TABLE events ADD COLUMN slug VARCHAR(255)`
    await sql`ALTER TABLE bands ADD COLUMN slug VARCHAR(255)`
    console.log('✅ Added slug columns\n')

    // Step 2: Generate and populate event slugs
    console.log('2. Generating event slugs...')
    const { rows: events } = await sql`
      SELECT id, name FROM events ORDER BY name
    `

    for (const event of events) {
      const slug = nameToSlug(event.name)
      await sql`
        UPDATE events 
        SET slug = ${slug} 
        WHERE id = ${event.id}
      `
      console.log(`   ✅ ${event.name} → ${slug}`)
    }
    console.log('✅ Generated event slugs\n')

    // Step 3: Generate and populate band slugs
    console.log('3. Generating band slugs...')
    const { rows: bands } = await sql`
      SELECT b.id, b.name, e.name as event_name
      FROM bands b
      JOIN events e ON b.event_id = e.id
      ORDER BY e.name, b."order"
    `

    for (const band of bands) {
      const slug = generateBandSlug(band.name, band.event_name)
      await sql`
        UPDATE bands 
        SET slug = ${slug} 
        WHERE id = ${band.id}
      `
      console.log(`   ✅ ${band.name} (${band.event_name}) → ${slug}`)
    }
    console.log('✅ Generated band slugs\n')

    // Step 4: Add unique constraints on slugs
    console.log('4. Adding unique constraints on slugs...')
    await sql`ALTER TABLE events ADD CONSTRAINT events_slug_unique UNIQUE (slug)`
    await sql`ALTER TABLE bands ADD CONSTRAINT bands_slug_unique UNIQUE (slug)`
    console.log('✅ Added unique constraints\n')

    // Step 5: Drop foreign key constraints temporarily
    console.log('5. Dropping foreign key constraints...')
    await sql`ALTER TABLE bands DROP CONSTRAINT bands_event_id_fkey`
    await sql`ALTER TABLE votes DROP CONSTRAINT votes_event_id_fkey`
    await sql`ALTER TABLE votes DROP CONSTRAINT votes_band_id_fkey`
    await sql`ALTER TABLE crowd_noise_measurements DROP CONSTRAINT crowd_noise_measurements_event_id_fkey`
    await sql`ALTER TABLE crowd_noise_measurements DROP CONSTRAINT crowd_noise_measurements_band_id_fkey`
    console.log('✅ Dropped foreign key constraints\n')

    // Step 6: Add new foreign key columns with slugs
    console.log('6. Adding new foreign key columns with slugs...')
    await sql`ALTER TABLE bands ADD COLUMN event_slug VARCHAR(255)`
    await sql`ALTER TABLE votes ADD COLUMN event_slug VARCHAR(255)`
    await sql`ALTER TABLE votes ADD COLUMN band_slug VARCHAR(255)`
    await sql`ALTER TABLE crowd_noise_measurements ADD COLUMN event_slug VARCHAR(255)`
    await sql`ALTER TABLE crowd_noise_measurements ADD COLUMN band_slug VARCHAR(255)`
    console.log('✅ Added new foreign key columns\n')

    // Step 7: Populate new foreign key columns
    console.log('7. Populating new foreign key columns...')

    // Update bands.event_slug
    await sql`
      UPDATE bands 
      SET event_slug = e.slug
      FROM events e 
      WHERE bands.event_id = e.id
    `
    console.log('   ✅ Updated bands.event_slug')

    // Update votes.event_slug
    await sql`
      UPDATE votes 
      SET event_slug = e.slug
      FROM events e 
      WHERE votes.event_id = e.id
    `
    console.log('   ✅ Updated votes.event_slug')

    // Update votes.band_slug
    await sql`
      UPDATE votes 
      SET band_slug = b.slug
      FROM bands b 
      WHERE votes.band_id = b.id
    `
    console.log('   ✅ Updated votes.band_slug')

    // Update crowd_noise_measurements.event_slug
    await sql`
      UPDATE crowd_noise_measurements 
      SET event_slug = e.slug
      FROM events e 
      WHERE crowd_noise_measurements.event_id = e.id
    `
    console.log('   ✅ Updated crowd_noise_measurements.event_slug')

    // Update crowd_noise_measurements.band_slug
    await sql`
      UPDATE crowd_noise_measurements 
      SET band_slug = b.slug
      FROM bands b 
      WHERE crowd_noise_measurements.band_id = b.id
    `
    console.log('   ✅ Updated crowd_noise_measurements.band_slug')
    console.log('✅ Populated new foreign key columns\n')

    // Step 8: Drop old UUID columns
    console.log('8. Dropping old UUID columns...')
    await sql`ALTER TABLE bands DROP COLUMN event_id`
    await sql`ALTER TABLE votes DROP COLUMN event_id`
    await sql`ALTER TABLE votes DROP COLUMN band_id`
    await sql`ALTER TABLE crowd_noise_measurements DROP COLUMN event_id`
    await sql`ALTER TABLE crowd_noise_measurements DROP COLUMN band_id`
    console.log('✅ Dropped old UUID columns\n')

    // Step 9: Rename slug columns to id
    console.log('9. Renaming slug columns to id...')
    await sql`ALTER TABLE events RENAME COLUMN id TO old_id`
    await sql`ALTER TABLE events RENAME COLUMN slug TO id`
    await sql`ALTER TABLE bands RENAME COLUMN id TO old_id`
    await sql`ALTER TABLE bands RENAME COLUMN slug TO id`
    console.log('✅ Renamed slug columns to id\n')

    // Step 10: Rename new foreign key columns
    console.log('10. Renaming new foreign key columns...')
    await sql`ALTER TABLE bands RENAME COLUMN event_slug TO event_id`
    await sql`ALTER TABLE votes RENAME COLUMN event_slug TO event_id`
    await sql`ALTER TABLE votes RENAME COLUMN band_slug TO band_id`
    await sql`ALTER TABLE crowd_noise_measurements RENAME COLUMN event_slug TO event_id`
    await sql`ALTER TABLE crowd_noise_measurements RENAME COLUMN band_slug TO band_id`
    console.log('✅ Renamed new foreign key columns\n')

    // Step 11: Add new foreign key constraints
    console.log('11. Adding new foreign key constraints...')
    await sql`ALTER TABLE bands ADD CONSTRAINT bands_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE`
    await sql`ALTER TABLE votes ADD CONSTRAINT votes_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE`
    await sql`ALTER TABLE votes ADD CONSTRAINT votes_band_id_fkey FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE`
    await sql`ALTER TABLE crowd_noise_measurements ADD CONSTRAINT crowd_noise_measurements_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE`
    await sql`ALTER TABLE crowd_noise_measurements ADD CONSTRAINT crowd_noise_measurements_band_id_fkey FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE`
    console.log('✅ Added new foreign key constraints\n')

    // Step 12: Drop old_id columns
    console.log('12. Dropping old_id columns...')
    await sql`ALTER TABLE events DROP COLUMN old_id`
    await sql`ALTER TABLE bands DROP COLUMN old_id`
    console.log('✅ Dropped old_id columns\n')

    // Step 13: Recreate indexes
    console.log('13. Recreating indexes...')
    await sql`CREATE INDEX IF NOT EXISTS idx_bands_event_id ON bands(event_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_votes_event_id ON votes(event_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_votes_band_id ON votes(band_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_crowd_noise_event_id ON crowd_noise_measurements(event_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_crowd_noise_band_id ON crowd_noise_measurements(band_id)`
    console.log('✅ Recreated indexes\n')

    console.log('🎉 Migration completed successfully!')
    console.log('\n📊 Summary:')
    console.log(`   • ${events.length} events converted to slugs`)
    console.log(`   • ${bands.length} bands converted to slugs`)
    console.log('   • All foreign key relationships updated')
    console.log('   • All indexes recreated')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    console.error('\n🔄 You may need to restore from backup and try again.')
    process.exit(1)
  }
}

// Run the migration
migrateUuidToSlugs()
