#!/usr/bin/env tsx

/**
 * Set the National Partner sponsor on one or more events.
 *
 * Merges a `national_partner` block into the event's `info` jsonb column,
 * which the event page renders as a "Powered by" SponsorBadge.
 *
 * Usage: pnpm tsx src/scripts/set-event-national-partner.ts
 */

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

config({ path: '.env.local' })

interface NationalPartner {
  name: string
  logo_url: string
  link?: string
}

const JUMBO: NationalPartner = {
  name: 'Jumbo Interactive',
  logo_url:
    'https://0qipqwe5exqqyona.public.blob.vercel-storage.com/companies/jumbo-interactive/logo.svg?v=1765880740505',
}

const eventPartners: Record<string, NationalPartner> = {
  'melbourne-2026': JUMBO,
}

async function setNationalPartners() {
  console.log('Setting National Partner on events...\n')

  for (const [eventId, partner] of Object.entries(eventPartners)) {
    try {
      const partnerJson = JSON.stringify({ national_partner: partner })
      const result = await sql`
        UPDATE events
        SET info = COALESCE(info, '{}'::jsonb) || ${partnerJson}::jsonb
        WHERE id = ${eventId}
        RETURNING id, name
      `

      if (result.rowCount === 0) {
        console.log(`⚠️  Event not found: ${eventId}`)
      } else {
        console.log(`✅ ${result.rows[0].name} → ${partner.name}`)
      }
    } catch (error) {
      console.error(`❌ Error updating ${eventId}:`, error)
    }
  }

  console.log('\n🎉 Done!')
  process.exit(0)
}

setNationalPartners()
