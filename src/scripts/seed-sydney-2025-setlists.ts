#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

// Load environment variables from .env.local
config({ path: '.env.local' })

// Map DATABASE_URL to POSTGRES_URL if needed
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

interface SetlistSong {
  band_id: string
  position: number
  song_type: 'cover' | 'mashup' | 'medley' | 'transition'
  title: string
  artist: string
  additional_songs?: { title: string; artist: string }[]
  transition_to_title?: string
  transition_to_artist?: string
}

const BAND_IDS = {
  atlassian: 'bandlassian-sydney-2025',
  canva: 'canvanauts-sydney-2025',
  google: 'the-incident-commanders-sydney-2025',
  banjo: 'the-special-guests-sydney-2025',
  salesforce: 'the-agentics-sydney-2025',
  amazon: 'jamazon-sydney-2025',
}

const songs: SetlistSong[] = [
  // ===== BANDLASSIAN (Atlassian) =====
  {
    band_id: BAND_IDS.atlassian,
    position: 1,
    song_type: 'cover',
    title: 'Africa',
    artist: 'Toto',
  },
  {
    band_id: BAND_IDS.atlassian,
    position: 2,
    song_type: 'cover',
    title: 'Rosanna',
    artist: 'Toto',
  },
  {
    band_id: BAND_IDS.atlassian,
    position: 3,
    song_type: 'cover',
    title: 'Learn to Fly',
    artist: 'Foo Fighters',
  },
  {
    band_id: BAND_IDS.atlassian,
    position: 4,
    song_type: 'cover',
    title: 'Somewhere Only We Know',
    artist: 'Keane',
  },
  {
    band_id: BAND_IDS.atlassian,
    position: 5,
    song_type: 'cover',
    title: 'September',
    artist: 'Earth, Wind & Fire',
  },

  // ===== CANVANAUTS (Canva) =====
  {
    band_id: BAND_IDS.canva,
    position: 1,
    song_type: 'cover',
    title: 'Are You Gonna Be My Girl',
    artist: 'Jet',
  },
  {
    band_id: BAND_IDS.canva,
    position: 2,
    song_type: 'cover',
    title: 'Anti-Hero',
    artist: 'Taylor Swift',
  }, // Done in Pendulum style
  {
    band_id: BAND_IDS.canva,
    position: 3,
    song_type: 'cover',
    title: 'Valerie',
    artist: 'Amy Winehouse',
  },
  {
    band_id: BAND_IDS.canva,
    position: 4,
    song_type: 'cover',
    title: "I'm Still Standing",
    artist: 'Elton John',
  },
  {
    band_id: BAND_IDS.canva,
    position: 5,
    song_type: 'cover',
    title: "Don't Stop Me Now",
    artist: 'Queen',
  },

  // ===== THE INCIDENT COMMANDERS (Google) =====
  {
    band_id: BAND_IDS.google,
    position: 1,
    song_type: 'cover',
    title: 'Bohemian Like You',
    artist: 'The Dandy Warhols',
  },
  {
    band_id: BAND_IDS.google,
    position: 2,
    song_type: 'cover',
    title: 'Song 2',
    artist: 'Blur',
  },
  {
    band_id: BAND_IDS.google,
    position: 3,
    song_type: 'cover',
    title: "Don't Start Now",
    artist: 'Dua Lipa',
  },
  {
    band_id: BAND_IDS.google,
    position: 4,
    song_type: 'cover',
    title: 'Call Me Maybe',
    artist: 'Carly Rae Jepsen',
  },
  {
    band_id: BAND_IDS.google,
    position: 5,
    song_type: 'cover',
    title: 'Dumb Things',
    artist: 'Paul Kelly',
  },
  {
    band_id: BAND_IDS.google,
    position: 6,
    song_type: 'cover',
    title: 'Used to Be in Love',
    artist: 'The Jungle Giants',
  },

  // ===== THE SPECIAL GUESTS (Banjo) =====
  {
    band_id: BAND_IDS.banjo,
    position: 1,
    song_type: 'cover',
    title: 'Mr Brightside',
    artist: 'The Killers',
  },
  {
    band_id: BAND_IDS.banjo,
    position: 2,
    song_type: 'cover',
    title: 'Boys in Town',
    artist: 'Divinyls',
  },
  {
    band_id: BAND_IDS.banjo,
    position: 3,
    song_type: 'cover',
    title: 'Hot Chilli Woman',
    artist: 'Noiseworks',
  },
  {
    band_id: BAND_IDS.banjo,
    position: 4,
    song_type: 'cover',
    title: 'Rebel Yell',
    artist: 'Billy Idol',
  },
  {
    band_id: BAND_IDS.banjo,
    position: 5,
    song_type: 'cover',
    title: 'Boys of Summer',
    artist: 'Don Henley',
  },

  // ===== THE AGENTICS (Salesforce) =====
  {
    band_id: BAND_IDS.salesforce,
    position: 1,
    song_type: 'cover',
    title: 'One Way or Another',
    artist: 'Blondie',
  },
  {
    band_id: BAND_IDS.salesforce,
    position: 2,
    song_type: 'cover',
    title: 'Just a Girl',
    artist: 'No Doubt',
  },
  {
    band_id: BAND_IDS.salesforce,
    position: 3,
    song_type: 'cover',
    title: 'Seven Nation Army',
    artist: 'The White Stripes',
  },
  {
    band_id: BAND_IDS.salesforce,
    position: 4,
    song_type: 'cover',
    title: 'Dumb Things',
    artist: 'Paul Kelly',
  },
  {
    band_id: BAND_IDS.salesforce,
    position: 5,
    song_type: 'cover',
    title: 'Just Like Heaven',
    artist: 'The Cure',
  },
  {
    band_id: BAND_IDS.salesforce,
    position: 6,
    song_type: 'cover',
    title: 'Hit Me With Your Best Shot',
    artist: 'Pat Benatar',
  },

  // ===== JAMAZON (Amazon) =====
  {
    band_id: BAND_IDS.amazon,
    position: 1,
    song_type: 'medley',
    title: 'Jump',
    artist: 'Van Halen',
    additional_songs: [
      { title: 'Jump', artist: 'Kris Kross' },
      { title: 'Jump Around', artist: 'House of Pain' },
    ],
  },
  {
    band_id: BAND_IDS.amazon,
    position: 2,
    song_type: 'cover',
    title: 'Tainted Love',
    artist: 'Soft Cell',
  },
  {
    band_id: BAND_IDS.amazon,
    position: 3,
    song_type: 'transition',
    title: 'If You Were the Rain',
    artist: 'Stephen Day',
    transition_to_title: 'Umbrella',
    transition_to_artist: 'Rihanna',
  },
  {
    band_id: BAND_IDS.amazon,
    position: 4,
    song_type: 'cover',
    title: 'APT',
    artist: 'Rosé & Bruno Mars',
  },
  {
    band_id: BAND_IDS.amazon,
    position: 5,
    song_type: 'cover',
    title: 'Stand By Me',
    artist: 'Ben E. King',
  },
  {
    band_id: BAND_IDS.amazon,
    position: 6,
    song_type: 'cover',
    title: 'Somebody to Love',
    artist: 'Queen',
  },
]

async function seedSetlists() {
  try {
    console.log('🎵 Seeding Sydney 2025 setlists...\n')

    // Check if any songs already exist for these bands
    const existingCheck = await sql`
      SELECT COUNT(*) as count FROM setlist_songs 
      WHERE band_id LIKE '%-sydney-2025'
    `

    if (Number(existingCheck.rows[0].count) > 0) {
      console.log('⚠️  Songs already exist for Sydney 2025 bands.')
      console.log('   Clearing existing songs first...')
      await sql`
        DELETE FROM setlist_songs 
        WHERE band_id LIKE '%-sydney-2025'
      `
      console.log('   ✓ Cleared existing songs.\n')
    }

    let insertedCount = 0

    for (const song of songs) {
      await sql`
        INSERT INTO setlist_songs (
          band_id, position, song_type, title, artist, 
          additional_songs, transition_to_title, transition_to_artist,
          status
        ) VALUES (
          ${song.band_id},
          ${song.position},
          ${song.song_type},
          ${song.title},
          ${song.artist},
          ${JSON.stringify(song.additional_songs || [])},
          ${song.transition_to_title || null},
          ${song.transition_to_artist || null},
          'locked'
        )
      `
      insertedCount++

      // Log special songs
      if (song.song_type === 'medley') {
        console.log(
          `   ✓ [${song.band_id}] ${song.position}. ${song.title} (MEDLEY with ${song.additional_songs?.length} more songs)`
        )
      } else if (song.song_type === 'transition') {
        console.log(
          `   ✓ [${song.band_id}] ${song.position}. ${song.title} → ${song.transition_to_title} (TRANSITION)`
        )
      } else {
        console.log(
          `   ✓ [${song.band_id}] ${song.position}. ${song.title} - ${song.artist}`
        )
      }
    }

    console.log(`\n✅ Successfully inserted ${insertedCount} songs!`)

    // Summary by band
    console.log('\n📊 Summary by band:')
    for (const [company, bandId] of Object.entries(BAND_IDS)) {
      const count = songs.filter((s) => s.band_id === bandId).length
      console.log(`   ${company}: ${count} songs`)
    }
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  }
}

seedSetlists()
