#!/usr/bin/env tsx

/**
 * Fetch Artist Metadata from MusicBrainz
 *
 * This script fetches metadata for all unique artists in setlist_songs
 * and stores it in the artist_metadata table.
 *
 * MusicBrainz API:
 * - No authentication required
 * - Rate limit: 1 request per second
 * - User-Agent required
 *
 * Usage: pnpm tsx src/scripts/fetch-artist-metadata.ts [--dry-run] [--force]
 *
 * Options:
 *   --dry-run  Show what would be fetched without making changes
 *   --force    Re-fetch all artists, even if already in database
 */

import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

// Import after dotenv config to ensure DB connection works
import { sql } from '@vercel/postgres'
import type { ArtistMetadata } from '../lib/db-types'

const USER_AGENT = 'BattleOfTheTechBands/1.0 (https://bottb.com.au)'
const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2'
const RATE_LIMIT_MS = 1100 // Slightly over 1 second to be safe

interface MusicBrainzArtist {
  id: string
  name: string
  'sort-name': string
  country?: string
  'life-span'?: {
    begin?: string
    ended?: boolean
  }
  tags?: Array<{ name: string; count: number }>
  disambiguation?: string
  type?: string
}

interface MusicBrainzSearchResponse {
  artists: MusicBrainzArtist[]
  count: number
  offset: number
}

interface UniqueArtist {
  artist: string
  normalized: string
  total_performances: number
  first_event_id: string
  first_event_date: string
}

/**
 * Normalize an artist name for consistent lookups
 */
function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['']/g, "'") // Normalize apostrophes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/^the\s+/i, '') // Remove leading "The"
}

/**
 * Wait for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Search MusicBrainz for an artist
 */
async function searchMusicBrainz(
  artistName: string
): Promise<MusicBrainzArtist | null> {
  const query = encodeURIComponent(`artist:"${artistName}"`)
  const url = `${MUSICBRAINZ_API}/artist?query=${query}&fmt=json&limit=5`

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    console.error(`  MusicBrainz API error: ${response.status}`)
    return null
  }

  const data: MusicBrainzSearchResponse = await response.json()

  if (data.artists.length === 0) {
    return null
  }

  // Return the best match (first result from MB is usually most relevant)
  // Could add fuzzy matching logic here if needed
  return data.artists[0]
}

/**
 * Fetch detailed artist info including tags
 */
async function getArtistDetails(
  mbid: string
): Promise<MusicBrainzArtist | null> {
  const url = `${MUSICBRAINZ_API}/artist/${mbid}?inc=tags&fmt=json`

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    console.error(`  MusicBrainz API error: ${response.status}`)
    return null
  }

  return response.json()
}

/**
 * Get all unique artists from setlist_songs with performance stats
 */
async function getUniqueArtists(): Promise<UniqueArtist[]> {
  const { rows } = await sql<UniqueArtist>`
    WITH artist_stats AS (
      SELECT 
        s.artist,
        COUNT(DISTINCT s.id) as total_performances,
        MIN(e.date) as first_event_date,
        (SELECT b2.event_id 
         FROM setlist_songs s2 
         JOIN bands b2 ON s2.band_id = b2.id
         JOIN events e2 ON b2.event_id = e2.id
         WHERE s2.artist = s.artist
         ORDER BY e2.date ASC
         LIMIT 1) as first_event_id
      FROM setlist_songs s
      JOIN bands b ON s.band_id = b.id
      JOIN events e ON b.event_id = e.id
      GROUP BY s.artist
    )
    SELECT 
      artist,
      total_performances::int,
      first_event_id,
      first_event_date::text
    FROM artist_stats
    ORDER BY total_performances DESC, artist ASC
  `

  return rows.map((row) => ({
    ...row,
    normalized: normalizeArtistName(row.artist),
  }))
}

/**
 * Get existing artist metadata entries
 */
async function getExistingArtists(): Promise<Set<string>> {
  const { rows } = await sql<{ artist_name_normalized: string }>`
    SELECT artist_name_normalized FROM artist_metadata
  `
  return new Set(rows.map((r) => r.artist_name_normalized))
}

/**
 * Upsert artist metadata
 */
async function upsertArtistMetadata(
  metadata: Omit<ArtistMetadata, 'created_at'>
): Promise<void> {
  // Convert genres array to PostgreSQL array literal
  const genresLiteral = metadata.genres?.length
    ? `{${metadata.genres.map((g) => `"${g.replace(/"/g, '\\"')}"`).join(',')}}`
    : null

  await sql`
    INSERT INTO artist_metadata (
      artist_name_normalized,
      display_name,
      musicbrainz_id,
      formed_year,
      country,
      genres,
      spotify_artist_id,
      first_performed_at,
      total_performances,
      fetched_at
    ) VALUES (
      ${metadata.artist_name_normalized},
      ${metadata.display_name},
      ${metadata.musicbrainz_id},
      ${metadata.formed_year},
      ${metadata.country},
      ${genresLiteral}::text[],
      ${metadata.spotify_artist_id},
      ${metadata.first_performed_at},
      ${metadata.total_performances},
      ${metadata.fetched_at}
    )
    ON CONFLICT (artist_name_normalized) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      musicbrainz_id = COALESCE(EXCLUDED.musicbrainz_id, artist_metadata.musicbrainz_id),
      formed_year = COALESCE(EXCLUDED.formed_year, artist_metadata.formed_year),
      country = COALESCE(EXCLUDED.country, artist_metadata.country),
      genres = CASE 
        WHEN array_length(EXCLUDED.genres, 1) > 0 THEN EXCLUDED.genres 
        ELSE artist_metadata.genres 
      END,
      spotify_artist_id = COALESCE(EXCLUDED.spotify_artist_id, artist_metadata.spotify_artist_id),
      first_performed_at = EXCLUDED.first_performed_at,
      total_performances = EXCLUDED.total_performances,
      fetched_at = EXCLUDED.fetched_at
  `
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const force = args.includes('--force')

  console.log('🎵 Fetching Artist Metadata from MusicBrainz')
  console.log('='.repeat(50))

  if (dryRun) {
    console.log('DRY RUN - No changes will be made\n')
  }

  // Get all unique artists
  console.log('📋 Getting unique artists from setlist_songs...')
  const artists = await getUniqueArtists()
  console.log(`   Found ${artists.length} unique artists\n`)

  // Get existing metadata
  const existing = await getExistingArtists()
  console.log(`   ${existing.size} artists already in database\n`)

  // Filter to artists that need fetching
  const toFetch = force
    ? artists
    : artists.filter((a) => !existing.has(a.normalized))

  if (toFetch.length === 0) {
    console.log(
      '✅ All artists already have metadata. Use --force to re-fetch.'
    )
    return
  }

  console.log(`🔍 Fetching metadata for ${toFetch.length} artists...\n`)

  let fetched = 0
  let notFound = 0
  let errors = 0

  for (const artist of toFetch) {
    console.log(
      `[${fetched + notFound + errors + 1}/${toFetch.length}] ${artist.artist}`
    )

    if (dryRun) {
      console.log(`   Would fetch from MusicBrainz\n`)
      fetched++
      continue
    }

    try {
      // Search for the artist
      await sleep(RATE_LIMIT_MS)
      const searchResult = await searchMusicBrainz(artist.artist)

      if (!searchResult) {
        console.log(`   ⚠️  Not found in MusicBrainz\n`)
        notFound++

        // Still store the artist with local data
        await upsertArtistMetadata({
          artist_name_normalized: artist.normalized,
          display_name: artist.artist,
          musicbrainz_id: null,
          formed_year: null,
          country: null,
          genres: [],
          description: null,
          spotify_artist_id: null,
          first_performed_at: artist.first_event_id,
          total_performances: artist.total_performances,
          fetched_at: new Date().toISOString(),
        })
        continue
      }

      // Get detailed info with tags
      await sleep(RATE_LIMIT_MS)
      const details = await getArtistDetails(searchResult.id)

      // Extract formed year from life-span
      let formedYear: number | null = null
      if (details?.['life-span']?.begin) {
        const year = parseInt(details['life-span'].begin.substring(0, 4), 10)
        if (!isNaN(year)) {
          formedYear = year
        }
      }

      // Extract top genres from tags (sorted by count)
      const genres =
        details?.tags
          ?.sort((a, b) => b.count - a.count)
          .slice(0, 5)
          .map((t) => t.name) || []

      const metadata: Omit<ArtistMetadata, 'created_at'> = {
        artist_name_normalized: artist.normalized,
        display_name: searchResult.name,
        musicbrainz_id: searchResult.id,
        formed_year: formedYear,
        country: searchResult.country || details?.country || null,
        genres,
        description: null, // Will be generated separately by AI
        spotify_artist_id: null, // Will be fetched separately
        first_performed_at: artist.first_event_id,
        total_performances: artist.total_performances,
        fetched_at: new Date().toISOString(),
      }

      await upsertArtistMetadata(metadata)

      console.log(`   ✅ ${searchResult.name}`)
      if (formedYear) console.log(`      Formed: ${formedYear}`)
      if (metadata.country) console.log(`      Country: ${metadata.country}`)
      if (genres.length > 0) console.log(`      Genres: ${genres.join(', ')}`)
      console.log(`      Performances: ${artist.total_performances}\n`)

      fetched++
    } catch (error) {
      console.error(`   ❌ Error: ${error}\n`)
      errors++
    }
  }

  console.log('='.repeat(50))
  console.log(`✅ Fetched: ${fetched}`)
  console.log(`⚠️  Not found: ${notFound}`)
  console.log(`❌ Errors: ${errors}`)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
