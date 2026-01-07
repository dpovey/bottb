#!/usr/bin/env tsx

/**
 * Backfill script to update existing videos with YouTube metadata.
 *
 * This script fetches metadata from YouTube Data API for all videos
 * that are missing published_at dates, enabling proper chronological sorting.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-video-metadata.ts
 *
 * Options:
 *   --dry-run    Preview changes without updating the database
 *   --all        Update all videos, not just those missing published_at
 *
 * Requirements:
 *   - YOUTUBE_API_KEY environment variable must be set
 *   - Database connection via POSTGRES_URL
 */

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'
import { fetchYouTubeVideoMetadata } from '../lib/youtube-api'

// Load environment variables from .env.local
config({ path: '.env.local' })

interface VideoRow {
  id: string
  youtube_video_id: string
  title: string
  published_at: string | null
  duration_seconds: number | null
}

async function getVideosToUpdate(all: boolean): Promise<VideoRow[]> {
  if (all) {
    const { rows } = await sql<VideoRow>`
      SELECT id, youtube_video_id, title, published_at, duration_seconds
      FROM videos
      ORDER BY created_at DESC
    `
    return rows
  }

  // Only get videos missing published_at
  const { rows } = await sql<VideoRow>`
    SELECT id, youtube_video_id, title, published_at, duration_seconds
    FROM videos
    WHERE published_at IS NULL
    ORDER BY created_at DESC
  `
  return rows
}

async function updateVideoMetadata(
  videoId: string,
  publishedAt: string | null,
  durationSeconds: number | null,
  title: string
): Promise<void> {
  await sql`
    UPDATE videos
    SET 
      published_at = ${publishedAt},
      duration_seconds = COALESCE(${durationSeconds}, duration_seconds),
      title = COALESCE(${title}, title)
    WHERE id = ${videoId}
  `
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const updateAll = args.includes('--all')

  if (!process.env.YOUTUBE_API_KEY) {
    console.error('❌ YOUTUBE_API_KEY environment variable is not set')
    console.error(
      'Please set it in .env.local or as an environment variable.\n'
    )
    console.error('To get an API key:')
    console.error('1. Go to https://console.cloud.google.com/')
    console.error('2. Create a project and enable YouTube Data API v3')
    console.error('3. Create an API key in Credentials')
    process.exit(1)
  }

  console.log('🎬 YouTube Video Metadata Backfill')
  console.log('===================================\n')

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n')
  }

  // Get videos to update
  const videos = await getVideosToUpdate(updateAll)

  if (videos.length === 0) {
    console.log('✅ No videos need updating!')
    if (!updateAll) {
      console.log('   (All videos already have published_at set)')
      console.log('   Use --all flag to update all videos')
    }
    return
  }

  console.log(`Found ${videos.length} video(s) to update\n`)

  let updated = 0
  let skipped = 0
  let failed = 0

  for (const video of videos) {
    process.stdout.write(`Processing: ${video.youtube_video_id}... `)

    try {
      const metadata = await fetchYouTubeVideoMetadata(video.youtube_video_id)

      if (!metadata) {
        console.log('⚠️  Not found on YouTube')
        skipped++
        continue
      }

      if (!metadata.publishedAt) {
        console.log('⚠️  No publish date available')
        skipped++
        continue
      }

      const publishDate = new Date(metadata.publishedAt)
      const formattedDate = publishDate.toISOString().split('T')[0]

      if (dryRun) {
        console.log(`✓ Would update: published_at=${formattedDate}`)
        if (metadata.durationSeconds) {
          console.log(`              duration=${metadata.durationSeconds}s`)
        }
      } else {
        await updateVideoMetadata(
          video.id,
          metadata.publishedAt,
          metadata.durationSeconds,
          metadata.title
        )
        console.log(`✅ Updated: published_at=${formattedDate}`)
      }

      updated++

      // Rate limit: YouTube API allows 10,000 units/day, each call is 1 unit
      // Add a small delay to be safe
      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch (error) {
      console.log(`❌ Error: ${error instanceof Error ? error.message : error}`)
      failed++
    }
  }

  console.log('\n===================================')
  console.log('Summary:')
  console.log(`  ✅ Updated: ${updated}`)
  console.log(`  ⚠️  Skipped: ${skipped}`)
  console.log(`  ❌ Failed: ${failed}`)

  if (dryRun && updated > 0) {
    console.log('\nRun without --dry-run to apply these changes.')
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
