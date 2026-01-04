#!/usr/bin/env tsx

/**
 * Generate Artist Descriptions using AI
 *
 * This script uses the Vercel AI SDK (OpenAI) to generate descriptions
 * for artists in the artist_metadata table.
 *
 * Descriptions are based on:
 * - MusicBrainz metadata (formed year, country, genres)
 * - BOTTB performance stats (total performances, first event)
 *
 * Usage: pnpm tsx src/scripts/generate-artist-descriptions.ts [--dry-run] [--force]
 *
 * Options:
 *   --dry-run  Show what would be generated without saving
 *   --force    Re-generate all descriptions, even if already set
 */

import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

// Import after dotenv config
import { sql } from '@vercel/postgres'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import type { ArtistMetadata } from '../lib/db-types'

interface ArtistWithEventInfo extends ArtistMetadata {
  first_event_name?: string
}

/**
 * Get all artists that need descriptions
 */
async function getArtistsNeedingDescriptions(
  force: boolean
): Promise<ArtistWithEventInfo[]> {
  if (force) {
    const { rows } = await sql<ArtistWithEventInfo>`
      SELECT 
        am.*,
        e.name as first_event_name
      FROM artist_metadata am
      LEFT JOIN events e ON am.first_performed_at = e.id
      ORDER BY am.total_performances DESC, am.display_name ASC
    `
    return rows
  } else {
    const { rows } = await sql<ArtistWithEventInfo>`
      SELECT 
        am.*,
        e.name as first_event_name
      FROM artist_metadata am
      LEFT JOIN events e ON am.first_performed_at = e.id
      WHERE am.description IS NULL
      ORDER BY am.total_performances DESC, am.display_name ASC
    `
    return rows
  }
}

/**
 * Build prompt for generating artist description
 */
function buildPrompt(artist: ArtistWithEventInfo): string {
  let prompt = `Generate a brief, engaging description (1-2 sentences) for the artist "${artist.display_name}" for use on a music event website. The description should be informative and interesting to fans.

ARTIST DATA:
- Name: ${artist.display_name}
`

  if (artist.country) {
    const countryName = getCountryName(artist.country)
    prompt += `- Origin: ${countryName}\n`
  }

  if (artist.formed_year) {
    // Check if this is likely a birth year (for solo artists) vs band formation year
    const currentYear = new Date().getFullYear()
    const age = currentYear - artist.formed_year
    if (age > 80) {
      // Likely a birth year, don't mention it directly
      prompt += `- Active since: ${artist.formed_year + 18}s (approximately)\n`
    } else if (age > 50) {
      prompt += `- Formed: ${artist.formed_year}\n`
    } else {
      prompt += `- Formed: ${artist.formed_year}\n`
    }
  }

  if (artist.genres && artist.genres.length > 0) {
    // Take top 3 genres, filter out meta tags
    const relevantGenres = artist.genres
      .filter(
        (g) =>
          !g.includes('pending') &&
          !g.includes('victim') &&
          !g.match(/^\d+s?$/) && // Filter out decade tags
          g.length > 2
      )
      .slice(0, 3)
    if (relevantGenres.length > 0) {
      prompt += `- Genres: ${relevantGenres.join(', ')}\n`
    }
  }

  prompt += `
BOTTB (Battle of the Tech Bands) STATS:
- Total cover performances at BOTTB: ${artist.total_performances}
`

  if (artist.first_event_name) {
    prompt += `- First appeared at: ${artist.first_event_name}\n`
  }

  if (artist.total_performances >= 3) {
    prompt += `- This is one of the most covered artists at BOTTB events\n`
  }

  prompt += `
REQUIREMENTS:
- Write 1-2 sentences maximum
- Be factual but engaging
- If they're a popular BOTTB artist (3+ performances), mention this
- Don't start with "The" unless it's part of the artist name
- Don't mention "Battle of the Tech Bands" directly, say "tech band competitions" or similar if relevant
- Focus on what makes them interesting or notable
- Avoid clichés like "iconic" or "legendary" unless truly warranted

OUTPUT: Just the description text, nothing else.`

  return prompt
}

/**
 * Convert country code to full name
 */
function getCountryName(code: string): string {
  const countries: Record<string, string> = {
    AU: 'Australian',
    US: 'American',
    GB: 'British',
    CA: 'Canadian',
    IE: 'Irish',
    IT: 'Italian',
    NZ: 'New Zealand',
    DE: 'German',
    FR: 'French',
    SE: 'Swedish',
    NO: 'Norwegian',
    JP: 'Japanese',
    KR: 'South Korean',
  }
  return countries[code] || code
}

/**
 * Generate description using AI
 */
async function generateDescription(
  artist: ArtistWithEventInfo
): Promise<string> {
  const prompt = buildPrompt(artist)

  const result = await generateText({
    model: openai('gpt-4o-mini'),
    prompt,
    maxRetries: 2,
    temperature: 0.7,
  })

  // Clean up the response
  let description = result.text.trim()
  // Remove surrounding quotes if present
  if (description.startsWith('"') && description.endsWith('"')) {
    description = description.slice(1, -1)
  }

  return description
}

/**
 * Update artist description in database
 */
async function updateArtistDescription(
  normalizedName: string,
  description: string
): Promise<void> {
  await sql`
    UPDATE artist_metadata 
    SET description = ${description}
    WHERE artist_name_normalized = ${normalizedName}
  `
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const force = args.includes('--force')

  console.log('🤖 Generating Artist Descriptions with AI')
  console.log('='.repeat(50))

  if (dryRun) {
    console.log('DRY RUN - No changes will be made\n')
  }

  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is required')
    process.exit(1)
  }

  // Get artists needing descriptions
  console.log('📋 Getting artists from database...')
  const artists = await getArtistsNeedingDescriptions(force)
  console.log(`   Found ${artists.length} artists needing descriptions\n`)

  if (artists.length === 0) {
    console.log(
      '✅ All artists already have descriptions. Use --force to regenerate.'
    )
    return
  }

  let generated = 0
  let errors = 0

  for (const artist of artists) {
    console.log(
      `[${generated + errors + 1}/${artists.length}] ${artist.display_name}`
    )

    if (dryRun) {
      console.log('   Would generate description\n')
      generated++
      continue
    }

    try {
      const description = await generateDescription(artist)

      await updateArtistDescription(artist.artist_name_normalized, description)

      console.log(`   ✅ "${description}"\n`)
      generated++
    } catch (error) {
      console.error(`   ❌ Error: ${error}\n`)
      errors++
    }
  }

  console.log('='.repeat(50))
  console.log(`✅ Generated: ${generated}`)
  console.log(`❌ Errors: ${errors}`)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
