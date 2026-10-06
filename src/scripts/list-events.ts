#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

// Load environment variables from .env.local
config({ path: '.env.local' })

async function listEvents(showBands = false) {
  try {
    // Get all events with band counts
    const { rows } = await sql`
      SELECT 
        e.id,
        e.name,
        e.date,
        e.location,
        e.is_active,
        e.status,
        COUNT(b.id) as band_count
      FROM events e
      LEFT JOIN bands b ON e.id = b.event_id
      GROUP BY e.id, e.name, e.date, e.location, e.is_active, e.status
      ORDER BY e.date DESC
    `

    if (rows.length === 0) {
      console.log('No events found.')
      return
    }

    console.log('📅 Events:\n')

    for (let index = 0; index < rows.length; index++) {
      const event = rows[index]
      const statusIcon = event.is_active ? '🟢' : '⚪'
      const statusText = String(event.status).toUpperCase()
      const date = new Date(event.date).toLocaleDateString()

      console.log(`${index + 1}. ${event.name}`)
      console.log(`   📍 ${event.location} • ${date}`)
      console.log(
        `   🎵 ${event.band_count} bands • ${statusIcon} ${statusText}`
      )
      console.log(`   🆔 ID: ${event.id}`)

      // Show bands if requested
      if (showBands && event.band_count > 0) {
        try {
          const { rows: bands } = await sql`
            SELECT id, name, description, "order", info
            FROM bands 
            WHERE event_id = ${event.id}
            ORDER BY "order" ASC
          `

          console.log(`   🎸 Bands:`)
          bands.forEach((band, bandIndex) => {
            console.log(`      ${bandIndex + 1}. ${band.name}`)
            console.log(`         🆔 ID: ${band.id}`)

            // Check for logo in info JSONB
            const logoUrl = band.info?.logo_url
            if (logoUrl) {
              console.log(`         🖼️  Logo: ${logoUrl}`)
            } else {
              console.log(`         🖼️  Logo: No logo available`)
            }

            // Show other info if available
            if (band.info?.website) {
              console.log(`         🌐 Website: ${band.info.website}`)
            }
            if (band.info?.genre) {
              console.log(`         🎵 Genre: ${band.info.genre}`)
            }
            if (band.info?.social_media?.twitter) {
              console.log(
                `         🐦 Twitter: ${band.info.social_media.twitter}`
              )
            }

            if (band.description) {
              console.log(`         ${band.description}`)
            }
          })
        } catch (error) {
          console.log(
            `   ❌ Error fetching bands: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          )
        }
      }

      console.log()
    }
  } catch (error) {
    console.error('❌ Error listing events:', error)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const showBands = args.includes('--bands') || args.includes('-b')

listEvents(showBands)
