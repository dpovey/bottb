#!/usr/bin/env tsx

/**
 * Record the raffle prize donors for an event.
 *
 * Merges `prize_donors` and `raffle_raised` into the event's `info` jsonb
 * column, which `/event/<id>/sponsors` renders as text cards.
 *
 * These are local businesses that donated prizes, not the tech companies in
 * the `companies` table — they field no band, so putting them there would
 * pollute /companies.
 *
 * Usage: pnpm tsx src/scripts/set-event-prize-donors.ts
 */

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

config({ path: '.env.local' })

interface PrizeDonor {
  name: string
  suburb?: string
  link?: string
  logo_url?: string
}

interface EventPrizeDonors {
  raffle_raised: string
  prize_donors: PrizeDonor[]
}

const LINKEDIN = (slug: string) => `https://www.linkedin.com/company/${slug}/`

const eventDonors: Record<string, EventPrizeDonors> = {
  'brisbane-2026': {
    raffle_raised: '$3,000',
    prize_donors: [
      {
        // The thank-you post names the legal entity, but the logo and the
        // shopfront both say Reading Cinemas; the legal name means nothing
        // to a reader, so it stays out of the UI.
        name: 'Reading Cinemas',
        suburb: 'Newmarket',
        link: LINKEDIN('reading-entertainment-australia-pty-ltd'),
      },
      {
        name: 'The Bathhouse Group',
        suburb: 'Albion',
        link: LINKEDIN('the-bathhouse-group'),
      },
      {
        name: 'Zero Latency VR',
        suburb: 'Newstead',
        link: LINKEDIN('zero-latency'),
      },
      {
        name: 'Merlo Coffee',
        suburb: 'Eagle Farm',
        link: LINKEDIN('merlo-coffee'),
      },
      {
        name: 'GoBoat Australia',
        suburb: 'Breakfast Creek',
        link: LINKEDIN('goboat-aunz'),
      },
      {
        // Plain text in the thank-you post with no link of any kind. Left
        // unlinked deliberately rather than guessing a URL.
        name: 'Activate Sports Recovery',
        suburb: 'Upper Mount Gravatt',
      },
    ],
  },
}

async function setPrizeDonors() {
  console.log('Setting raffle prize donors on events...\n')

  for (const [eventId, donors] of Object.entries(eventDonors)) {
    try {
      const donorsJson = JSON.stringify(donors)
      const result = await sql`
        UPDATE events
        SET info = COALESCE(info, '{}'::jsonb) || ${donorsJson}::jsonb
        WHERE id = ${eventId}
        RETURNING id, name
      `

      if (result.rowCount === 0) {
        console.log(`⚠️  Event not found: ${eventId}`)
      } else {
        console.log(
          `✅ ${result.rows[0].name} → ${donors.prize_donors.length} prize donors, raffle ${donors.raffle_raised}`
        )
      }
    } catch (error) {
      console.error(`❌ Error updating ${eventId}:`, error)
    }
  }

  console.log('\n🎉 Done!')
  process.exit(0)
}

setPrizeDonors()
