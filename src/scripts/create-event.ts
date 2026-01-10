#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'
import { readFileSync } from 'fs'

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

// Helper function to generate band slug using event ID (not full name)
function generateBandSlug(bandName: string, eventId: string): string {
  const bandSlug = nameToSlug(bandName)
  return `${bandSlug}-${eventId}`
}

// Valid scoring versions
type ScoringVersion = '2022.1' | '2025.1' | '2026.1'

function isValidScoringVersion(version: string): version is ScoringVersion {
  return version === '2022.1' || version === '2025.1' || version === '2026.1'
}

interface EventData {
  id?: string // Optional custom ID (e.g., "brisbane-2024" instead of auto-generated)
  name: string
  date: string
  location: string
  timezone: string // IANA timezone name (e.g., "Australia/Brisbane")
  address?: string
  tickets?: string
  description?: string // Event description (displayed on event page)
  is_active?: boolean
  status?: 'upcoming' | 'voting' | 'finalized'
  scoring_version?: string // Scoring version: "2022.1", "2025.1", "2026.1"
  winner?: string // Winner name (for 2022.1 events)
  bands: {
    name: string
    company_slug: string // REQUIRED: Foreign key to companies table (e.g., "rex-software")
    description?: string // Band description (displayed on band page)
    band_description?: string // DEPRECATED: Use description instead. Kept for backward compatibility.
    order: number
  }[]
}

// Helper to look up company by slug and validate it exists
async function validateCompanySlug(
  slug: string
): Promise<{ valid: boolean; name?: string }> {
  const { rows } = await sql`SELECT name FROM companies WHERE slug = ${slug}`
  if (rows.length > 0) {
    return { valid: true, name: rows[0].name }
  }
  return { valid: false }
}

// Get all companies for error messages
async function getAllCompanySlugs(): Promise<string[]> {
  const { rows } = await sql`SELECT slug FROM companies ORDER BY slug`
  return rows.map((r) => r.slug)
}

async function createEventFromFile(filePath: string) {
  try {
    // Read and parse JSON file
    const fileContent = readFileSync(filePath, 'utf-8')
    const eventData: EventData = JSON.parse(fileContent)

    console.log(`Creating event: ${eventData.name}`)

    // Use custom ID if provided, otherwise generate from name
    const eventSlug = eventData.id || nameToSlug(eventData.name)
    console.log(
      `📝 Event slug: ${eventSlug}${eventData.id ? ' (custom)' : ' (auto-generated)'}`
    )

    // Validate and set scoring version
    const scoringVersion = eventData.scoring_version || '2026.1' // Default to latest
    if (!isValidScoringVersion(scoringVersion)) {
      console.error(`❌ Invalid scoring_version: ${scoringVersion}`)
      console.error('   Valid values: 2022.1, 2025.1, 2026.1')
      process.exit(1)
    }
    console.log(`📊 Scoring version: ${scoringVersion}`)

    // Build event info JSONB object
    interface EventInfo {
      scoring_version: string
      address?: string
      tickets?: string
      winner?: string
    }

    const eventInfo: EventInfo = {
      scoring_version: scoringVersion,
    }

    if (eventData.address) {
      eventInfo.address = eventData.address
    }
    if (eventData.tickets) {
      eventInfo.tickets = eventData.tickets
    }

    // For 2022.1 events, store the winner in event info
    if (scoringVersion === '2022.1' && eventData.winner) {
      eventInfo.winner = eventData.winner
      console.log(`🏆 Winner: ${eventData.winner}`)
    }

    // Validate timezone
    if (!eventData.timezone) {
      console.error('❌ Missing required field: timezone')
      console.error('   Example: "Australia/Brisbane"')
      process.exit(1)
    }
    console.log(`🌏 Timezone: ${eventData.timezone}`)

    // Log description if provided
    if (eventData.description) {
      console.log(
        `📝 Description: ${eventData.description.substring(0, 50)}...`
      )
    }

    // Create event with slug as ID and info JSONB
    const { rows: eventRows } = await sql`
      INSERT INTO events (id, name, date, location, timezone, is_active, status, info, description)
      VALUES (
        ${eventSlug}, 
        ${eventData.name}, 
        ${eventData.date}, 
        ${eventData.location},
        ${eventData.timezone},
        ${eventData.is_active ?? true}, 
        ${eventData.status ?? 'upcoming'},
        ${JSON.stringify(eventInfo)}::jsonb,
        ${eventData.description || null}
      )
      RETURNING id, name
    `

    const event = eventRows[0]
    console.log(`✅ Event created with ID: ${event.id}`)

    // Create bands
    if (eventData.bands && eventData.bands.length > 0) {
      console.log(`Creating ${eventData.bands.length} bands...`)

      // First, validate all company_slugs exist
      console.log('\n🔍 Validating company links...')
      const invalidCompanies: { band: string; slug: string }[] = []
      const validatedCompanies: Map<string, string> = new Map() // slug -> name

      for (const band of eventData.bands) {
        if (!band.company_slug) {
          console.error(
            `❌ Band "${band.name}" is missing required company_slug`
          )
          console.error(
            '   Each band MUST have a company_slug that links to the companies table.'
          )
          const availableSlugs = await getAllCompanySlugs()
          console.error(
            `   Available company slugs: ${availableSlugs.join(', ')}`
          )
          process.exit(1)
        }

        const validation = await validateCompanySlug(band.company_slug)
        if (!validation.valid) {
          invalidCompanies.push({ band: band.name, slug: band.company_slug })
        } else {
          validatedCompanies.set(band.company_slug, validation.name!)
          console.log(
            `  ✅ ${band.name} → ${validation.name} (${band.company_slug})`
          )
        }
      }

      if (invalidCompanies.length > 0) {
        console.error('\n❌ Invalid company_slug values found:')
        for (const { band, slug } of invalidCompanies) {
          console.error(
            `   - Band "${band}" has invalid company_slug: "${slug}"`
          )
        }
        const availableSlugs = await getAllCompanySlugs()
        console.error(
          `\n   Available company slugs: ${availableSlugs.join(', ')}`
        )
        console.error('\n   To add a new company, run:')
        console.error(
          '   psql "$POSTGRES_URL" -c "INSERT INTO companies (slug, name) VALUES (\'new-slug\', \'Company Name\');"'
        )
        process.exit(1)
      }

      console.log('\n📦 Creating bands...')
      for (const band of eventData.bands) {
        // Generate band slug using event ID (not full name)
        const bandSlug = generateBandSlug(band.name, eventSlug)
        console.log(`  📝 Band slug: ${bandSlug}`)

        // Get company name
        const companyName = validatedCompanies.get(band.company_slug)!

        // Use description field, fallback to band_description for backward compatibility
        const bandDescription =
          band.description || band.band_description || null

        // Build band info object - store band_description for backward compatibility only
        interface BandInfo {
          band_description?: string
        }
        const bandInfo: BandInfo = {}
        if (band.band_description) {
          // Keep in info for backward compatibility
          bandInfo.band_description = band.band_description
        }

        const { rows: bandRows } = await sql`
          INSERT INTO bands (id, event_id, name, description, company_slug, "order", info)
          VALUES (${bandSlug}, ${event.id}, ${band.name}, ${bandDescription}, ${band.company_slug}, ${band.order}, ${JSON.stringify(bandInfo)}::jsonb)
          RETURNING id, name
        `

        console.log(
          `  ✅ Band created: ${bandRows[0].name} (${bandRows[0].id}) → ${companyName}`
        )
        if (bandDescription) {
          console.log(`     📝 With description`)
        }
      }
    }

    console.log(`\n🎉 Event "${eventData.name}" created successfully!`)
    console.log(`Event ID: ${event.id}`)
    console.log(`Scoring Version: ${scoringVersion}`)
    console.log(`Bands: ${eventData.bands.length}`)
  } catch (error) {
    console.error('❌ Error creating event:', error)
    process.exit(1)
  }
}

// Get file path from command line arguments
const filePath = process.argv[2]

if (!filePath) {
  console.error('Usage: tsx create-event.ts <path-to-json-file>')
  console.error('Example: tsx create-event.ts events/sydney-2024.json')
  console.error('\nJSON file should include:')
  console.error("  - id: event slug (e.g., 'sydney-2025')")
  console.error('  - name: event name')
  console.error('  - date: ISO date string (UTC)')
  console.error('  - location: venue name')
  console.error(
    "  - timezone: IANA timezone (e.g., 'Australia/Brisbane', 'Australia/Sydney')"
  )
  console.error('  - description: event description (displayed on event page)')
  console.error(
    "  - scoring_version: '2022.1' | '2025.1' | '2026.1' (default: '2026.1')"
  )
  console.error('  - winner: (for 2022.1 events only) winner band name')
  console.error('  - bands: array of band objects with:')
  console.error('      - name: band name')
  console.error('      - company_slug: REQUIRED foreign key to companies table')
  console.error('      - description: optional band description')
  console.error('      - order: display order (1, 2, 3...)')
  process.exit(1)
}

// Check if file exists
import { accessSync } from 'fs'
try {
  accessSync(filePath)
} catch {
  console.error(`❌ File not found: ${filePath}`)
  process.exit(1)
}

createEventFromFile(filePath)
