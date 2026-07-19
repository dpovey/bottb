import { sql } from '@vercel/postgres'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

/**
 * Seed the initial videographers.
 *
 * Run with:  pnpm tsx src/scripts/seed-videographers.ts
 * (Requires the `videographers` / `event_videographers` tables — run
 * `pnpm migrate` first.)
 *
 * Videographers are tagged to whole events. Event tags are applied only
 * when the referenced event already exists, so an as-yet-uncreated event
 * (e.g. melbourne-2026) is skipped with a warning rather than failing.
 */
interface VideographerSeed {
  slug: string
  name: string
  bio: string
  location: string
  website: string | null
  instagram: string | null
  email: string | null
  avatar_url: string | null
  /** Event ids this videographer filmed */
  eventIds: string[]
}

const videographers: VideographerSeed[] = [
  {
    slug: 'jacob-briant',
    name: 'Jacob Briant',
    bio: 'Australian photographer and videographer with a deep love of live music. Jacob shot Battle of the Tech Bands Brisbane 2025 on both stills and video, capturing the raw emotion, the energy of a full band, and the electric connection between performers and the crowd. Alongside gigs he covers festivals, studio sessions, and promotional shoots.',
    location: 'Brisbane, Australia',
    website: 'https://jacobbriantphotography.com.au/',
    instagram: 'https://www.instagram.com/j.b_photo/',
    email: null,
    avatar_url: null,
    eventIds: ['brisbane-2025'],
  },
  {
    slug: 'ramsay-waterhouse',
    name: 'Ramsay Waterhouse',
    bio: 'Melbourne-based freelance filmmaker and director of photography. Ramsay filmed Battle of the Tech Bands Melbourne 2026, bringing a filmmaker’s eye to live performance — chasing the light, the movement and the vibe of the room.',
    location: 'Melbourne, Australia',
    website: 'https://www.linkedin.com/in/ramsay-waterhouse-aa19b038b/',
    instagram: 'https://www.instagram.com/ramsaywaterhouse/',
    email: null,
    avatar_url: null,
    eventIds: ['melbourne-2026'],
  },
]

async function seed() {
  console.log('🎬 Starting videographer seed...\n')

  try {
    for (const v of videographers) {
      console.log(`🎥 Processing ${v.name}...`)

      const { rows: existing } = await sql`
        SELECT slug FROM videographers WHERE slug = ${v.slug}
      `

      if (existing.length > 0) {
        await sql`
          UPDATE videographers SET
            name = ${v.name},
            bio = ${v.bio},
            location = ${v.location},
            website = ${v.website},
            instagram = ${v.instagram},
            email = ${v.email},
            avatar_url = ${v.avatar_url}
          WHERE slug = ${v.slug}
        `
        console.log(`   ↻ Updated ${v.name}`)
      } else {
        await sql`
          INSERT INTO videographers (slug, name, bio, location, website, instagram, email, avatar_url)
          VALUES (${v.slug}, ${v.name}, ${v.bio}, ${v.location}, ${v.website}, ${v.instagram}, ${v.email}, ${v.avatar_url})
        `
        console.log(`   ✓ Added ${v.name}`)
      }

      // Tag events (only those that exist)
      for (const eventId of v.eventIds) {
        const { rowCount } = await sql`
          INSERT INTO event_videographers (event_id, videographer_slug)
          SELECT ${eventId}, ${v.slug}
          WHERE EXISTS (SELECT 1 FROM events WHERE id = ${eventId})
          ON CONFLICT DO NOTHING
        `
        if (rowCount && rowCount > 0) {
          console.log(`   🔗 Tagged event ${eventId}`)
        } else {
          const { rows: already } = await sql`
            SELECT 1 FROM event_videographers
            WHERE event_id = ${eventId} AND videographer_slug = ${v.slug}
          `
          if (already.length > 0) {
            console.log(`   🔗 Event ${eventId} already tagged`)
          } else {
            console.warn(
              `   ⚠️  Event "${eventId}" not found — skipped (tag it later once the event exists)`
            )
          }
        }
      }
    }

    console.log('\n✨ Seed completed successfully!')
    console.log(`   ${videographers.length} videographers processed.`)
  } catch (error) {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

seed()
