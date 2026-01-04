#!/usr/bin/env tsx

/**
 * Generate Artist Descriptions (Local/Template-based)
 *
 * Generates descriptions from artist metadata without AI API calls.
 * Uses templates and the structured data we have from MusicBrainz and DB.
 *
 * Usage: pnpm tsx src/scripts/generate-descriptions-local.ts
 *
 * Outputs: /tmp/artist-descriptions.json for review before import
 */

import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

// Import after dotenv config
import { sql } from '@vercel/postgres'
import { writeFileSync } from 'fs'

interface Performance {
  event_id: string
  event_name: string
  event_date: string
  band_name: string
  company_name: string
  song_title: string
}

interface ArtistData {
  artist_name_normalized: string
  display_name: string
  musicbrainz_id: string | null
  formed_year: number | null
  country: string | null
  genres: string[] | null
  description: string | null
  spotify_artist_id: string | null
  first_performed_at: string | null
  total_performances: number
  fetched_at: string | null
  created_at: string
  performances: Performance[]
}

interface GeneratedDescription {
  artist_name_normalized: string
  display_name: string
  description: string
  context: {
    country: string | null
    formed_year: number | null
    genres: string[]
    total_performances: number
    events: string[]
    bands: string[]
    companies: string[]
    songs: string[]
  }
}

const COUNTRY_NAMES: Record<string, string> = {
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

function getCountryAdjective(code: string | null): string | null {
  if (!code) return null
  return COUNTRY_NAMES[code] || code
}

function getRelevantGenres(genres: string[] | null): string[] {
  if (!genres) return []
  return genres
    .filter(
      (g) =>
        !g.includes('pending') &&
        !g.includes('victim') &&
        !g.match(/^\d+s?$/) && // Filter decade tags like "00s"
        !g.match(/^(british|american|australian|canadian)$/i) && // Filter nationality tags
        g.length > 2
    )
    .slice(0, 3)
}

function formatGenres(genres: string[]): string {
  if (genres.length === 0) return ''
  if (genres.length === 1) return genres[0]
  if (genres.length === 2) return `${genres[0]} and ${genres[1]}`
  return `${genres.slice(0, -1).join(', ')}, and ${genres[genres.length - 1]}`
}

function generateDescription(artist: ArtistData): string {
  const parts: string[] = []

  const countryAdj = getCountryAdjective(artist.country)
  const genres = getRelevantGenres(artist.genres)
  const formedYear = artist.formed_year

  // Determine if this is likely a solo artist (birth year) vs band (formation year)
  const currentYear = new Date().getFullYear()
  const isSoloArtist = formedYear && currentYear - formedYear > 70

  // Get unique values from performances
  const performances = artist.performances.filter((p) => p.event_id) // Filter nulls
  const uniqueEvents = [...new Set(performances.map((p) => p.event_name))]
  const uniqueBands = [...new Set(performances.map((p) => p.band_name))]
  const uniqueCompanies = [...new Set(performances.map((p) => p.company_name))]
  const uniqueSongs = [...new Set(performances.map((p) => p.song_title))]

  // Build opening phrase
  if (countryAdj && genres.length > 0) {
    if (isSoloArtist) {
      parts.push(`${countryAdj} ${formatGenres(genres)} artist`)
    } else if (formedYear) {
      parts.push(
        `${countryAdj} ${formatGenres(genres)} act formed in ${formedYear}`
      )
    } else {
      parts.push(`${countryAdj} ${formatGenres(genres)} act`)
    }
  } else if (countryAdj) {
    if (isSoloArtist) {
      parts.push(`${countryAdj} musician`)
    } else if (formedYear) {
      parts.push(`${countryAdj} act formed in ${formedYear}`)
    } else {
      parts.push(`${countryAdj} act`)
    }
  } else if (genres.length > 0) {
    if (formedYear && !isSoloArtist) {
      parts.push(`${formatGenres(genres)} act formed in ${formedYear}`)
    } else {
      parts.push(`${formatGenres(genres)} artist`)
    }
  }

  // Build the description sentence
  let description = ''

  if (parts.length > 0) {
    description = parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + '.'
  }

  // Add BOTTB performance context
  if (artist.total_performances >= 3) {
    description += ` One of the most covered artists at Battle of the Tech Bands with ${artist.total_performances} performances.`
  } else if (artist.total_performances === 2) {
    if (uniqueEvents.length === 2) {
      description += ` Covered at both ${uniqueEvents[0]} and ${uniqueEvents[1]}.`
    } else if (uniqueBands.length === 2) {
      description += ` Covered by ${uniqueBands[0]} and ${uniqueBands[1]}.`
    } else {
      description += ` Featured in ${artist.total_performances} performances at BOTTB events.`
    }
  } else if (uniqueSongs.length === 1 && uniqueBands.length === 1) {
    description += ` "${uniqueSongs[0]}" was performed by ${uniqueBands[0]} (${uniqueCompanies[0]}) at ${uniqueEvents[0]}.`
  }

  // Clean up
  description = description.trim()

  // If we couldn't generate anything meaningful, use a simple fallback
  if (!description || description.length < 10) {
    if (uniqueSongs.length > 0) {
      description = `Known for "${uniqueSongs[0]}"${uniqueSongs.length > 1 ? ` and ${uniqueSongs.length - 1} other song${uniqueSongs.length > 2 ? 's' : ''} covered at BOTTB` : ''}.`
    } else {
      description = `Featured artist at Battle of the Tech Bands events.`
    }
  }

  return description
}

async function main() {
  console.log('📝 Generating Artist Descriptions (Local)')
  console.log('='.repeat(50))

  // Get artist metadata with performance details
  const { rows } = await sql<ArtistData>`
    SELECT 
      am.*,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'event_id', e.id,
            'event_name', e.name,
            'event_date', e.date,
            'band_name', b.name,
            'company_name', c.name,
            'song_title', s.title
          )
        ) FILTER (WHERE e.id IS NOT NULL),
        '[]'::json
      ) as performances
    FROM artist_metadata am
    LEFT JOIN setlist_songs s ON LOWER(TRIM(s.artist)) = am.artist_name_normalized
       OR LOWER(TRIM(REPLACE(s.artist, 'The ', ''))) = am.artist_name_normalized
    LEFT JOIN bands b ON s.band_id = b.id
    LEFT JOIN events e ON b.event_id = e.id
    LEFT JOIN companies c ON b.company_slug = c.slug
    GROUP BY am.artist_name_normalized
    ORDER BY am.total_performances DESC, am.display_name ASC
  `

  console.log(`Found ${rows.length} artists\n`)

  const results: GeneratedDescription[] = []

  for (const artist of rows) {
    const description = generateDescription(artist)
    const performances = artist.performances.filter((p) => p.event_id)

    results.push({
      artist_name_normalized: artist.artist_name_normalized,
      display_name: artist.display_name,
      description,
      context: {
        country: artist.country,
        formed_year: artist.formed_year,
        genres: getRelevantGenres(artist.genres),
        total_performances: artist.total_performances,
        events: [...new Set(performances.map((p) => p.event_name))],
        bands: [...new Set(performances.map((p) => p.band_name))],
        companies: [...new Set(performances.map((p) => p.company_name))],
        songs: [...new Set(performances.map((p) => p.song_title))],
      },
    })

    console.log(`${artist.display_name}:`)
    console.log(`  ${description}\n`)
  }

  // Save to file
  const outputPath = '/tmp/artist-descriptions.json'
  writeFileSync(outputPath, JSON.stringify(results, null, 2))
  console.log('='.repeat(50))
  console.log(`✅ Saved ${results.length} descriptions to ${outputPath}`)
  console.log(
    '\nReview the file and run the import script to save to database.'
  )
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
