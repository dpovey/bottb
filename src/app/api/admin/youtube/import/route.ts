/**
 * YouTube Video Import API
 *
 * POST /api/admin/youtube/import - Import selected videos from YouTube scan
 *
 * Body:
 * - videos: Array of { videoId, title, eventId?, bandId?, isShort }
 *
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'
import { fetchYouTubeVideoMetadata } from '@/lib/youtube-api'
import { createVideo, getVideoByYoutubeId } from '@/lib/db'

interface ImportVideoRequest {
  videoId: string
  title: string
  eventId?: string | null
  bandId?: string | null
  isShort?: boolean
}

interface ImportResult {
  videoId: string
  success: boolean
  error?: string
  video?: {
    id: string
    title: string
  }
}

const handleImportVideos: ProtectedApiHandler = async (
  request: NextRequest
) => {
  try {
    const body = await request.json()
    const { videos } = body as { videos: ImportVideoRequest[] }

    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json(
        { error: 'No videos to import' },
        { status: 400 }
      )
    }

    const results: ImportResult[] = []

    for (const videoReq of videos) {
      const { videoId, title, eventId, bandId, isShort } = videoReq

      try {
        // Check if video already exists
        const existing = await getVideoByYoutubeId(videoId)
        if (existing) {
          results.push({
            videoId,
            success: false,
            error: 'Video already exists in database',
          })
          continue
        }

        // Fetch metadata from YouTube for additional info
        const metadata = await fetchYouTubeVideoMetadata(videoId)

        // Create the video in the database
        const video = await createVideo({
          youtube_video_id: videoId,
          title: title || metadata?.title || 'Untitled',
          event_id: eventId || null,
          band_id: bandId || null,
          duration_seconds: metadata?.durationSeconds || null,
          thumbnail_url: metadata?.thumbnailUrl || null,
          published_at: metadata?.publishedAt || null,
          sort_order: 0,
          video_type: isShort ? 'short' : 'video',
        })

        results.push({
          videoId,
          success: true,
          video: {
            id: video.id,
            title: video.title,
          },
        })
      } catch (error) {
        results.push({
          videoId,
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to import video',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      message: `Imported ${successCount} videos, ${failCount} failed`,
      successCount,
      failCount,
      results,
    })
  } catch (error) {
    console.error('Error importing videos:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to import videos',
      },
      { status: 500 }
    )
  }
}

export const POST = withAdminProtection(handleImportVideos)
