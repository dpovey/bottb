#!/usr/bin/env tsx

/**
 * Seed the FINAL Melbourne 2026 setlists (as performed) and lock them.
 *
 * The event is already finalized; songs are inserted with status 'locked' so
 * they show publicly (band page requires finalized event + locked song).
 *
 * Convention for "A / B" entries: A = canonical artist (drives conflict
 * detection), B = the cover band whose rendition was performed (cover_artist).
 *
 * "Murder on the Dancefloor" is performed by two bands (OUA = original, REA =
 * the Royel Otis version). That's a real duplicate, but it happened on the
 * night — so we lock both directly and do NOT recompute conflict status (which
 * would flip them to 'conflict' and hide them).
 *
 * Idempotent: replaces each band's setlist on every run.
 *
 * Usage: pnpm exec tsx src/scripts/seed-melbourne-2026-setlists.ts
 */

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'
import { v7 as uuidv7 } from 'uuid'
import { triggerRevalidate } from '../lib/revalidate-client'

config({ path: '.env.local' })

const EVENT_ID = 'melbourne-2026'

interface Song {
  title: string
  artist: string // canonical artist
  cover_artist?: string // the cover band actually performed, if different
  song_type?: 'cover' | 'mashup' | 'medley'
  additional_songs?: { title: string; artist: string }[]
}

const SETLISTS: Record<string, Song[]> = {
  // OUA
  'continuously-groovin-melbourne-2026': [
    { title: 'Take Me Out', artist: 'Franz Ferdinand' },
    { title: 'Everybody Wants to Rule the World', artist: 'Tears for Fears' },
    { title: 'Superstition', artist: 'Stevie Wonder' },
    { title: 'Dancing in the Moonlight', artist: 'Toploader' },
    { title: 'When You Were Young', artist: 'The Killers' },
    { title: 'Murder on the Dancefloor', artist: 'Sophie Ellis-Bextor' },
  ],
  // Jumbo
  'jumbo-melbourne-2026': [
    { title: 'Smoko', artist: 'The Chats' },
    { title: 'Beer', artist: 'Reel Big Fish' },
    { title: 'Mr. Brightside', artist: 'The Killers' },
    { title: 'Chelsea Dagger', artist: 'The Fratellis' },
    { title: 'I Believe in a Thing Called Love', artist: 'The Darkness' },
    { title: 'Take the Power Back', artist: 'Rage Against the Machine' },
  ],
  // REA Group
  'hot-property-melbourne-2026': [
    { title: 'Sk8er Boi', artist: 'Avril Lavigne' },
    { title: 'Are You Gonna Be My Girl', artist: 'Jet' },
    {
      title: 'Murder on the Dancefloor',
      artist: 'Sophie Ellis-Bextor',
      cover_artist: 'Royel Otis',
    },
    { title: "What's My Scene", artist: 'Hoodoo Gurus' },
    { title: 'Golden', artist: 'Huntr/x' },
    { title: "Livin' on a Prayer", artist: 'Bon Jovi' },
  ],
  // SEEK
  'fully-seek-melbourne-2026': [
    { title: 'Where Is My Husband!', artist: 'Raye' },
    { title: 'Lose Control', artist: 'Teddy Swims' },
    {
      title: 'P.Y.T. (Pretty Young Thing)',
      artist: 'Michael Jackson',
      song_type: 'medley',
      additional_songs: [
        { title: 'Billie Jean', artist: 'Michael Jackson' },
        { title: 'Thriller', artist: 'Michael Jackson' },
      ],
    },
    { title: 'Cry Me a River', artist: 'Justin Timberlake' },
  ],
  // Mentorloop
  'loop-there-it-is-melbourne-2026': [
    { title: 'Are You Gonna Go My Way', artist: 'Lenny Kravitz' },
    { title: 'Fell in Love with a Girl', artist: 'The White Stripes' },
    {
      title: 'Torn',
      artist: 'Natalie Imbruglia',
      cover_artist: 'Kontrollverlust',
    },
    { title: 'You Give Love a Bad Name', artist: 'Bon Jovi' },
    {
      title: 'I Will Survive',
      artist: 'Gloria Gaynor',
      cover_artist: 'Me First and the Gimme Gimmes',
    },
    { title: 'Am I Ever Gonna See Your Face Again', artist: 'The Angels' },
  ],
}

async function main() {
  console.log('\n\u{1F3B8} Seeding final Melbourne 2026 setlists (locked)\n')

  for (const [bandId, songs] of Object.entries(SETLISTS)) {
    const { rows } =
      await sql`SELECT name FROM bands WHERE id = ${bandId} AND event_id = ${EVENT_ID}`
    if (!rows.length) {
      throw new Error(`Band not found: ${bandId}`)
    }

    await sql`DELETE FROM setlist_songs WHERE band_id = ${bandId}`

    let position = 1
    for (const s of songs) {
      await sql`
        INSERT INTO setlist_songs (
          id, band_id, position, song_type, title, artist, cover_artist,
          additional_songs, status
        )
        VALUES (
          ${uuidv7()}, ${bandId}, ${position}, ${s.song_type ?? 'cover'},
          ${s.title}, ${s.artist}, ${s.cover_artist ?? null},
          ${JSON.stringify(s.additional_songs ?? [])}::jsonb, 'locked'
        )
      `
      position++
    }
    console.log(
      `✅ ${rows[0].name.padEnd(22)} (${bandId}) — ${songs.length} songs locked`
    )
  }

  await triggerRevalidate({
    paths: [
      '/',
      '/events',
      `/event/${EVENT_ID}`,
      '/songs',
      '/band/continuously-groovin-melbourne-2026',
      '/band/hot-property-melbourne-2026',
      '/band/fully-seek-melbourne-2026',
      '/band/loop-there-it-is-melbourne-2026',
      '/band/jumbo-melbourne-2026',
    ],
    tags: ['nav-events'],
  }).catch(() => {})

  console.log('\n\u{1F389} Done — setlists locked and revalidated.')
  process.exit(0)
}

main().catch((e) => {
  console.error('❌ Seed failed:', e)
  process.exit(1)
})
