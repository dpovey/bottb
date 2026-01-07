#!/usr/bin/env tsx

/**
 * Seed script to add missing videos and shorts to the database.
 *
 * This script adds:
 * - 6 missing regular videos
 * - 13 YouTube Shorts
 *
 * Usage:
 *   npx tsx src/scripts/seed-videos-and-shorts.ts
 */

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

// Load environment variables from .env.local
config({ path: '.env.local' })

interface VideoSeed {
  youtube_video_id: string
  title: string
  event_id: string | null
  band_name: string | null // We'll resolve this to band_id
  video_type: 'video' | 'short'
}

// Missing regular videos
const MISSING_VIDEOS: VideoSeed[] = [
  {
    youtube_video_id: 'OUKSHrRhemM',
    title:
      'Blondie - One Way (Live Cover) - Salesforce - Sydney Battle of the Tech Bands 2025',
    event_id: 'sydney-2025',
    band_name: 'The Agentics',
    video_type: 'video',
  },
  {
    youtube_video_id: '8WNhLXSzboo',
    title:
      'The Jungle Giants - Used to be in Love (Live Cover) - Google - Sydney Battle of the Tech Bands 2025',
    event_id: 'sydney-2025',
    band_name: 'Power Chords',
    video_type: 'video',
  },
  {
    youtube_video_id: 'DPdaqWVJPXY',
    title:
      'The Chats - Smoko (Live Cover) - Jumbo - Brisbane Battle of the Tech Bands 2025',
    event_id: 'brisbane-2025',
    band_name: 'Jumbo Band',
    video_type: 'video',
  },
  {
    youtube_video_id: 'DGdSOJ02NmQ',
    title:
      'The Commitments - Mustang Sally (Live Cover) - Rex Software - Brisbane Battle of the Tech Bands 2025',
    event_id: 'brisbane-2025',
    band_name: 'The ShipRex',
    video_type: 'video',
  },
  {
    youtube_video_id: 'Jc1OwOA1t3o',
    title:
      'Måneskin - Off My Face (Live cover) - For the Record - Brisbane Battle of the Tech Bands',
    event_id: 'brisbane-2025',
    band_name: 'Off The Record',
    video_type: 'video',
  },
  {
    youtube_video_id: 'kR4S19XZ-AU',
    title: 'Battle of the Tech Bands',
    event_id: null,
    band_name: null,
    video_type: 'video',
  },
]

// YouTube Shorts
const SHORTS: VideoSeed[] = [
  {
    youtube_video_id: 'xrFzlW2NmZo',
    title:
      'Alexa introduces Jamazon at the Sydney Battle of the Tech Bands 2025',
    event_id: 'sydney-2025',
    band_name: 'Jamazon',
    video_type: 'short',
  },
  {
    youtube_video_id: '8uEu0Ax7iLI',
    title:
      'Rosanna - Toto - Live cover performed by Atlassian @ Sydney Battle of the Tech Bands 2025',
    event_id: 'sydney-2025',
    band_name: 'Bandlassian',
    video_type: 'short',
  },
  {
    youtube_video_id: '4h95Cyp7ujI',
    title:
      'Seven Nation Army - The White Stripes performed by Salesforce @ Sydney Battle of the Tech Bands 2025',
    event_id: 'sydney-2025',
    band_name: 'The Agentics',
    video_type: 'short',
  },
  {
    youtube_video_id: '9LkaakAP3L8',
    title:
      'Used to be in Love - The Jungle Giants performed by Google @ Sydney Battle of the Tech Bands 2025',
    event_id: 'sydney-2025',
    band_name: 'Power Chords',
    video_type: 'short',
  },
  {
    youtube_video_id: '_8Dv7OAGyiU',
    title:
      "Backstage with The Special Guests - Banjo's entrant into the 2025 Sydney Battle of the Tech Bands",
    event_id: 'sydney-2025',
    band_name: 'The Special Guests',
    video_type: 'short',
  },
  {
    youtube_video_id: 'kvz2gAoBfnk',
    title:
      "🎤 Backstage with The Canvanauts — Canva's entrant in the 2025 Sydney Battle of the Tech Bands",
    event_id: 'sydney-2025',
    band_name: 'Canvanauts',
    video_type: 'short',
  },
  {
    youtube_video_id: 'kSH118J98a4',
    title:
      'Backstage with Bandlassian from Atlassian - Crowd Favourite at Sydney Battle of the Tech Bands 2025',
    event_id: 'sydney-2025',
    band_name: 'Bandlassian',
    video_type: 'short',
  },
  {
    youtube_video_id: '62DcaUDhvX0',
    title:
      'Backstage with Jamazon from Amazon - Runners-up for the Sydney Battle of the Tech Bands 2025',
    event_id: 'sydney-2025',
    band_name: 'Jamazon',
    video_type: 'short',
  },
  {
    youtube_video_id: 'YRLvujzCYxE',
    title:
      'Backstage with the Agentics from Salesforce - Winners of Sydney Battle of the Tech Bands 2025',
    event_id: 'sydney-2025',
    band_name: 'The Agentics',
    video_type: 'short',
  },
  {
    youtube_video_id: '6lhMhH83c7o',
    title: 'Battle of the Tech Bands - Sydney 2025 - Highlights',
    event_id: 'sydney-2025',
    band_name: null,
    video_type: 'short',
  },
  {
    youtube_video_id: 't5BYeBNz_T8',
    title: 'Off the Record - Brisbane Battle of the Tech Bands 2025',
    event_id: 'brisbane-2025',
    band_name: 'Off The Record',
    video_type: 'short',
  },
  {
    youtube_video_id: '6Psd_BB--9g',
    title:
      'Epsonics from Epsilon at the Brisbane Battle of the Tech Bands 2025',
    event_id: 'brisbane-2025',
    band_name: 'Epsonics',
    video_type: 'short',
  },
]

async function getBandIdByName(
  bandName: string,
  eventId: string
): Promise<string | null> {
  const { rows } = await sql<{ id: string }>`
    SELECT id FROM bands 
    WHERE name = ${bandName} AND event_id = ${eventId}
    LIMIT 1
  `
  return rows[0]?.id || null
}

async function videoExists(youtubeVideoId: string): Promise<boolean> {
  const { rows } = await sql<{ count: string }>`
    SELECT COUNT(*) as count FROM videos WHERE youtube_video_id = ${youtubeVideoId}
  `
  return parseInt(rows[0]?.count || '0', 10) > 0
}

async function seedVideos() {
  console.log('🎬 Seeding videos and shorts...\n')

  const allVideos = [...MISSING_VIDEOS, ...SHORTS]
  let added = 0
  let skipped = 0

  for (const video of allVideos) {
    // Check if video already exists
    if (await videoExists(video.youtube_video_id)) {
      console.log(`⏭️  Skipping (already exists): ${video.title}`)
      skipped++
      continue
    }

    // Resolve band_id from band_name
    let bandId: string | null = null
    if (video.band_name && video.event_id) {
      bandId = await getBandIdByName(video.band_name, video.event_id)
      if (!bandId) {
        console.log(
          `⚠️  Warning: Could not find band "${video.band_name}" for event "${video.event_id}"`
        )
      }
    }

    // Generate thumbnail URL
    const thumbnailUrl = `https://img.youtube.com/vi/${video.youtube_video_id}/maxresdefault.jpg`

    // Insert the video
    await sql`
      INSERT INTO videos (youtube_video_id, title, event_id, band_id, thumbnail_url, video_type, sort_order)
      VALUES (
        ${video.youtube_video_id},
        ${video.title},
        ${video.event_id},
        ${bandId},
        ${thumbnailUrl},
        ${video.video_type},
        0
      )
    `

    const typeIcon = video.video_type === 'short' ? '📱' : '🎥'
    console.log(`${typeIcon} Added: ${video.title}`)
    added++
  }

  console.log(
    `\n✅ Done! Added ${added} videos, skipped ${skipped} (already exist)`
  )
}

// Run the seed
seedVideos()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error seeding videos:', error)
    process.exit(1)
  })
