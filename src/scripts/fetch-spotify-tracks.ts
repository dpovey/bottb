#!/usr/bin/env tsx

/**
 * Fetch Spotify Track IDs for Setlist Songs
 *
 * This script uses the Spotify Web API to find track IDs for songs
 * in the setlist_songs table, enabling "Listen on Spotify" links.
 *
 * Spotify API:
 * - Requires SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET
 * - Uses Client Credentials flow (no user auth needed)
 * - Rate limit: Generally generous for search
 *
 * Usage: pnpm tsx src/scripts/fetch-spotify-tracks.ts [--dry-run] [--force]
 *
 * Options:
 *   --dry-run  Show what would be fetched without making changes
 *   --force    Re-fetch all tracks, even if already set
 */

import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

// Import after dotenv config
import { sql } from '@vercel/postgres'

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search'

interface SpotifyTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface SpotifyTrack {
  id: string
  name: string
  artists: { name: string }[]
  album: { name: string }
  external_urls: { spotify: string }
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[]
    total: number
  }
}

interface SetlistSongRecord {
  id: string
  title: string
  artist: string
  spotify_track_id: string | null
  band_name: string | null
}

let accessToken: string | null = null
let tokenExpiry: number = 0

/**
 * Get Spotify access token using Client Credentials flow
 */
async function getAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables are required.\n' +
        'Get these from https://developer.spotify.com/dashboard'
    )
  }

  // Return cached token if still valid
  if (accessToken && Date.now() < tokenExpiry - 60000) {
    return accessToken
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64'
  )

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get Spotify token: ${error}`)
  }

  const data: SpotifyTokenResponse = await response.json()
  accessToken = data.access_token
  tokenExpiry = Date.now() + data.expires_in * 1000

  return accessToken
}

/**
 * Search Spotify for a track
 */
async function searchTrack(
  title: string,
  artist: string
): Promise<SpotifyTrack | null> {
  const token = await getAccessToken()

  // Clean up artist name for search
  const cleanArtist = artist.replace(/&/g, 'and').replace(/\s+/g, ' ').trim()

  // Clean up title
  const cleanTitle = title
    .replace(/\(.*?\)/g, '') // Remove parenthetical notes
    .replace(/\s+/g, ' ')
    .trim()

  const query = encodeURIComponent(
    `track:"${cleanTitle}" artist:"${cleanArtist}"`
  )
  const url = `${SPOTIFY_SEARCH_URL}?q=${query}&type=track&limit=5`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    console.error(`  Spotify API error: ${response.status}`)
    return null
  }

  const data: SpotifySearchResponse = await response.json()

  if (data.tracks.items.length === 0) {
    // Try a broader search without quotes
    const broadQuery = encodeURIComponent(`${cleanTitle} ${cleanArtist}`)
    const broadUrl = `${SPOTIFY_SEARCH_URL}?q=${broadQuery}&type=track&limit=5`

    const broadResponse = await fetch(broadUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (broadResponse.ok) {
      const broadData: SpotifySearchResponse = await broadResponse.json()
      if (broadData.tracks.items.length > 0) {
        return broadData.tracks.items[0]
      }
    }

    return null
  }

  return data.tracks.items[0]
}

/**
 * Get all setlist songs that need Spotify track IDs
 */
async function getSongsNeedingTracks(
  force: boolean
): Promise<SetlistSongRecord[]> {
  if (force) {
    const { rows } = await sql<SetlistSongRecord>`
      SELECT s.id, s.title, s.artist, s.spotify_track_id, b.name as band_name
      FROM setlist_songs s
      JOIN bands b ON s.band_id = b.id
      ORDER BY s.artist, s.title
    `
    return rows
  } else {
    const { rows } = await sql<SetlistSongRecord>`
      SELECT s.id, s.title, s.artist, s.spotify_track_id, b.name as band_name
      FROM setlist_songs s
      JOIN bands b ON s.band_id = b.id
      WHERE s.spotify_track_id IS NULL
      ORDER BY s.artist, s.title
    `
    return rows
  }
}

/**
 * Update song with Spotify track ID
 */
async function updateSongSpotifyId(
  songId: string,
  spotifyTrackId: string
): Promise<void> {
  await sql`
    UPDATE setlist_songs 
    SET spotify_track_id = ${spotifyTrackId}
    WHERE id = ${songId}
  `
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const force = args.includes('--force')

  console.log('🎵 Fetching Spotify Track IDs')
  console.log('='.repeat(50))

  if (dryRun) {
    console.log('DRY RUN - No changes will be made\n')
  }

  // Check for credentials early
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.error('❌ Missing Spotify credentials!')
    console.error('')
    console.error('Add these to your .env.local:')
    console.error('  SPOTIFY_CLIENT_ID=your_client_id')
    console.error('  SPOTIFY_CLIENT_SECRET=your_client_secret')
    console.error('')
    console.error(
      'Get credentials from: https://developer.spotify.com/dashboard'
    )
    process.exit(1)
  }

  // Get songs needing track IDs
  console.log('📋 Getting setlist songs...')
  const songs = await getSongsNeedingTracks(force)
  console.log(`   Found ${songs.length} songs needing Spotify track IDs\n`)

  if (songs.length === 0) {
    console.log(
      '✅ All songs already have Spotify track IDs. Use --force to re-fetch.'
    )
    return
  }

  let found = 0
  let notFound = 0
  let errors = 0

  // Group by artist+title to avoid duplicate lookups
  const uniqueSongs = new Map<string, SetlistSongRecord[]>()
  for (const song of songs) {
    const key = `${song.artist}|||${song.title}`
    if (!uniqueSongs.has(key)) {
      uniqueSongs.set(key, [])
    }
    uniqueSongs.get(key)!.push(song)
  }

  console.log(`🔍 Searching for ${uniqueSongs.size} unique tracks...\n`)

  let processed = 0
  for (const [key, songRecords] of uniqueSongs) {
    const [artist, title] = key.split('|||')
    processed++
    console.log(`[${processed}/${uniqueSongs.size}] "${title}" by ${artist}`)

    if (dryRun) {
      console.log(`   Would search Spotify\n`)
      found++
      continue
    }

    try {
      const track = await searchTrack(title, artist)

      if (!track) {
        console.log(`   ⚠️  Not found on Spotify\n`)
        notFound++
        continue
      }

      // Update all song records with this artist+title combo
      for (const songRecord of songRecords) {
        await updateSongSpotifyId(songRecord.id, track.id)
      }

      console.log(
        `   ✅ Found: ${track.name} by ${track.artists.map((a) => a.name).join(', ')}`
      )
      console.log(`      ID: ${track.id}\n`)
      found++
    } catch (error) {
      console.error(`   ❌ Error: ${error}\n`)
      errors++
    }
  }

  console.log('='.repeat(50))
  console.log(`✅ Found: ${found}`)
  console.log(`⚠️  Not found: ${notFound}`)
  console.log(`❌ Errors: ${errors}`)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
