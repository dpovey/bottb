#!/usr/bin/env tsx

/**
 * Set (or clear) early-bird ticket pricing on an event.
 *
 * Merges an `early_bird` block into the event's `info` jsonb column. The event
 * page and event card render the deadline as a callout and stop rendering it
 * the moment `ends_at` passes, so an offer expires itself — there is no
 * follow-up run needed to take the banner down.
 *
 * `ends_at` must carry an explicit UTC offset. The cutoff is a wall-clock
 * promise made in the event's own city, and a bare timestamp would be read as
 * UTC and expire hours early there (10 hours early for a Brisbane event).
 *
 * Usage:
 *   pnpm tsx src/scripts/set-event-early-bird.ts <event-id> <ends-at> [price]
 *   pnpm tsx src/scripts/set-event-early-bird.ts <event-id> --clear
 *
 * Examples:
 *   # Early bird runs through the end of 1 August, Brisbane time
 *   pnpm tsx src/scripts/set-event-early-bird.ts brisbane-2026 2026-08-01T23:59:59+10:00
 *
 *   # ...and advertise the price alongside the deadline
 *   pnpm tsx src/scripts/set-event-early-bird.ts brisbane-2026 2026-08-01T23:59:59+10:00 '$45'
 *
 *   # Pull the offer immediately, ahead of its deadline
 *   pnpm tsx src/scripts/set-event-early-bird.ts brisbane-2026 --clear
 */

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

config({ path: '.env.local' })

const OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/

async function main() {
  const [eventId, endsAt, price] = process.argv.slice(2)

  if (!eventId || !endsAt) {
    console.error(
      'Usage: set-event-early-bird.ts <event-id> <ends-at-iso> [price]\n' +
        '       set-event-early-bird.ts <event-id> --clear'
    )
    process.exit(1)
  }

  const clearing = endsAt === '--clear'

  if (!clearing) {
    if (!OFFSET_RE.test(endsAt)) {
      console.error(
        `❌ ends_at must include an explicit UTC offset, e.g. ` +
          `2026-08-01T23:59:59+10:00 — got "${endsAt}".`
      )
      process.exit(1)
    }
    if (isNaN(new Date(endsAt).getTime())) {
      console.error(`❌ Could not parse ends_at: "${endsAt}"`)
      process.exit(1)
    }
  }

  const patch = clearing
    ? JSON.stringify({ early_bird: null })
    : JSON.stringify({
        early_bird: price ? { ends_at: endsAt, price } : { ends_at: endsAt },
      })

  // `||` merges the block in; a null value is then stripped so clearing leaves
  // no empty key behind.
  const result = await sql`
    UPDATE events
    SET info = (COALESCE(info, '{}'::jsonb) || ${patch}::jsonb) - (
      CASE WHEN ${clearing} THEN 'early_bird' ELSE '' END
    )
    WHERE id = ${eventId}
    RETURNING id, name, timezone, info -> 'early_bird' AS early_bird
  `

  if (result.rowCount === 0) {
    console.error(`⚠️  Event not found: ${eventId}`)
    process.exit(1)
  }

  const row = result.rows[0]
  if (clearing) {
    console.log(`✅ Cleared early-bird pricing on ${row.name}`)
  } else {
    const local = new Date(endsAt).toLocaleString('en-AU', {
      timeZone: row.timezone,
      dateStyle: 'full',
      timeStyle: 'short',
    })
    console.log(`✅ ${row.name} early bird → ${JSON.stringify(row.early_bird)}`)
    console.log(`   Closes ${local} (${row.timezone})`)
  }

  process.exit(0)
}

main()
