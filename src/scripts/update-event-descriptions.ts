#!/usr/bin/env tsx

/**
 * Update event descriptions in the database
 *
 * Usage: pnpm tsx src/scripts/update-event-descriptions.ts
 */

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

// Load environment variables
config({ path: '.env.local' })

const descriptions = {
  'brisbane-2024':
    "In its third year, Battle of the Tech Bands returned to The Triffid in Newstead for another night of tech industry talent colliding with rock and roll. Five bands from Brisbane's growing tech scene took the stage, each bringing their own flavour to the competition. Sponsored by Jumbo Interactive, the event continued to raise funds for Youngcare while cementing BOTTB's place as a beloved fixture in Brisbane's live music calendar. When the votes were counted, it was The Fuggles from FoundU who emerged victorious, capping off a memorable night with a well-earned win.",
  'brisbane-2025':
    "With the movement expanding to Sydney for the first time, Brisbane's fourth Battle of the Tech Bands proved the original city still knew how to bring the noise. Four bands descended on The Triffid in Newstead, keeping the energy high and the competition fierce. Proudly supported by Jumbo Interactive, this event was the first half of BOTTB's biggest year yet — ten bands across two cities all raising money for Youngcare. In the end, Off The Record from For the Record claimed the Brisbane crown, setting the stage for Sydney's inaugural battle just weeks later.",
}

async function updateDescriptions() {
  console.log('Updating event descriptions...\n')

  for (const [eventId, description] of Object.entries(descriptions)) {
    try {
      const result = await sql`
        UPDATE events 
        SET description = ${description}
        WHERE id = ${eventId}
        RETURNING id, name
      `

      if (result.rowCount === 0) {
        console.log(`⚠️  Event not found: ${eventId}`)
      } else {
        console.log(`✅ Updated: ${result.rows[0].name}`)
      }
    } catch (error) {
      console.error(`❌ Error updating ${eventId}:`, error)
    }
  }

  console.log('\n🎉 Done!')
  process.exit(0)
}

updateDescriptions()
