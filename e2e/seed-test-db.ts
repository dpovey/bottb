/**
 * Seed script for E2E test database
 *
 * Seeds the test database from JSON fixtures.
 * Run this locally to populate the test DB, then use pg_dump to cache it.
 *
 * Usage:
 *   DATABASE_URL=postgres://test:test@localhost:5433/bottb_test tsx e2e/seed-test-db.ts
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import bcrypt from 'bcrypt'

// We use pg directly here instead of @vercel/postgres to connect to local Docker
import { Client } from 'pg'

const FIXTURES_DIR = join(__dirname, 'fixtures', 'data')
const SCHEMA_PATH = join(dirname(__dirname), 'src', 'lib', 'schema.sql')

interface Event {
  id: string
  name: string
  date: string
  location: string
  timezone: string
  is_active: boolean
  status: string
  image_url?: string
}

interface Company {
  slug: string
  name: string
  logo_url?: string
  icon_url?: string
  website?: string
}

interface Photographer {
  slug: string
  name: string
  bio?: string
  location?: string
  website?: string
  instagram?: string
  email?: string
  avatar_url?: string
}

interface Band {
  id: string
  event_id: string
  name: string
  description?: string
  company_slug?: string
  order: number
  image_url?: string
  info?: Record<string, unknown>
}

interface Vote {
  event_id: string
  band_id: string
  voter_type: string
  song_choice?: number
  performance?: number
  crowd_vibe?: number
  crowd_vote?: number
  name?: string
}

interface Photo {
  id: string
  blob_url: string
  blob_pathname: string
  event_id: string
  band_id: string
  photographer_slug: string
  labels: string[]
  hero_focal_point: { x: number; y: number }
}

interface User {
  id: string
  email: string
  password: string
  name: string
  is_admin: boolean
}

interface FinalizedResult {
  event_id: string
  band_id: string
  band_name: string
  final_rank: number
  avg_song_choice: number | null
  avg_performance: number | null
  avg_crowd_vibe: number | null
  crowd_vote_count: number
  judge_vote_count: number
  total_crowd_votes: number
  judge_score: number | null
  crowd_score: number | null
  total_score: number | null
}

function loadFixture<T>(filename: string): T {
  const filepath = join(FIXTURES_DIR, filename)
  const content = readFileSync(filepath, 'utf-8')
  return JSON.parse(content) as T
}

async function main() {
  const databaseUrl =
    process.env.DATABASE_URL || 'postgres://test:test@localhost:5433/bottb_test'

  console.log('Connecting to database...')
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    console.log('Loading fixtures...')
    const events = loadFixture<Event[]>('events.json')
    const companies = loadFixture<Company[]>('companies.json')
    const photographers = loadFixture<Photographer[]>('photographers.json')
    const bands = loadFixture<Band[]>('bands.json')
    const votes = loadFixture<Vote[]>('votes.json')
    const photos = loadFixture<Photo[]>('photos.json')
    const users = loadFixture<User[]>('users.json')
    const finalizedResults = loadFixture<FinalizedResult[]>(
      'finalized_results.json'
    )

    console.log('Dropping and recreating schema...')
    await client.query('DROP SCHEMA public CASCADE')
    await client.query('CREATE SCHEMA public')
    await client.query('GRANT ALL ON SCHEMA public TO test')
    await client.query('GRANT ALL ON SCHEMA public TO public')

    console.log('Creating schema from canonical schema.sql...')
    const schema = readFileSync(SCHEMA_PATH, 'utf-8')
    await client.query(schema)

    console.log('Seeding users...')
    for (const user of users) {
      const passwordHash = await bcrypt.hash(user.password, 12)
      await client.query(
        `INSERT INTO users (id, email, password_hash, name, is_admin)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, user.email, passwordHash, user.name, user.is_admin]
      )
    }
    console.log(`  Inserted ${users.length} users`)

    console.log('Seeding events...')
    for (const event of events) {
      await client.query(
        `INSERT INTO events (id, name, date, location, timezone, is_active, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          event.id,
          event.name,
          event.date,
          event.location,
          event.timezone,
          event.is_active,
          event.status,
        ]
      )
    }
    console.log(`  Inserted ${events.length} events`)

    console.log('Seeding companies...')
    for (const company of companies) {
      await client.query(
        `INSERT INTO companies (slug, name, logo_url, icon_url, website)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          company.slug,
          company.name,
          company.logo_url,
          company.icon_url,
          company.website,
        ]
      )
    }
    console.log(`  Inserted ${companies.length} companies`)

    console.log('Seeding photographers...')
    for (const photographer of photographers) {
      await client.query(
        `INSERT INTO photographers (slug, name, bio, location, website, instagram, email, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          photographer.slug,
          photographer.name,
          photographer.bio,
          photographer.location,
          photographer.website,
          photographer.instagram,
          photographer.email,
          photographer.avatar_url,
        ]
      )
    }
    console.log(`  Inserted ${photographers.length} photographers`)

    console.log('Seeding bands...')
    for (const band of bands) {
      await client.query(
        `INSERT INTO bands (id, event_id, name, description, company_slug, "order", info)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          band.id,
          band.event_id,
          band.name,
          band.description,
          band.company_slug,
          band.order,
          JSON.stringify(band.info || {}),
        ]
      )
    }
    console.log(`  Inserted ${bands.length} bands`)

    console.log('Seeding votes...')
    for (const vote of votes) {
      await client.query(
        `INSERT INTO votes (event_id, band_id, voter_type, song_choice, performance, crowd_vibe, crowd_vote, name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          vote.event_id,
          vote.band_id,
          vote.voter_type,
          vote.song_choice,
          vote.performance,
          vote.crowd_vibe,
          vote.crowd_vote,
          vote.name,
        ]
      )
    }
    console.log(`  Inserted ${votes.length} votes`)

    console.log('Seeding photos...')
    for (const photo of photos) {
      await client.query(
        `INSERT INTO photos (blob_url, blob_pathname, event_id, band_id, photographer, labels, hero_focal_point)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          photo.blob_url,
          photo.blob_pathname,
          photo.event_id,
          photo.band_id,
          photo.photographer_slug, // Use photographer_slug from fixture as photographer
          photo.labels,
          JSON.stringify(photo.hero_focal_point),
        ]
      )
    }
    console.log(`  Inserted ${photos.length} photos`)

    console.log('Seeding finalized results...')
    for (const result of finalizedResults) {
      await client.query(
        `INSERT INTO finalized_results (
          event_id, band_id, band_name, final_rank,
          avg_song_choice, avg_performance, avg_crowd_vibe,
          crowd_vote_count, judge_vote_count, total_crowd_votes,
          judge_score, crowd_score, total_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          result.event_id,
          result.band_id,
          result.band_name,
          result.final_rank,
          result.avg_song_choice,
          result.avg_performance,
          result.avg_crowd_vibe,
          result.crowd_vote_count,
          result.judge_vote_count,
          result.total_crowd_votes,
          result.judge_score,
          result.crowd_score,
          result.total_score,
        ]
      )
    }
    console.log(`  Inserted ${finalizedResults.length} finalized results`)

    console.log('\n✅ Database seeded successfully!')
    console.log('\nTo cache for CI, run:')
    console.log(
      '  PGPASSWORD=test pg_dump -h localhost -p 5433 -U test bottb_test > e2e/fixtures/test-db.sql'
    )
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error('Seeding failed:', error)
  process.exit(1)
})
