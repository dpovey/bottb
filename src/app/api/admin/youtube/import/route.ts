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
import {
  withAdminProtection,
  withErrorHandling,
  ProtectedApiHandler,
} from '@/lib/api-protection'
import { parseBody, youtubeImportSchema } from '@/lib/api-schemas'
import { fetchYouTubeVideoMetadata } from '@/lib/youtube-api'
import { createVideo, getVideoByYoutubeId } from '@/lib/db'

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
  const parsed = await parseBody(request, youtubeImportSchema)
  if (!parsed.ok) return parsed.response
  const { videos } = parsed.data

  const results: ImportResult[] = []

  for (const videoReq of videos) {
    const { videoId, title, eventId, bandId, isShort } = videoReq

    try {
      const existing = await getVideoByYoutubeId(videoId)
      if (existing) {
        results.push({
          videoId,
          success: false,
          error: 'Video already exists in database',
        })
        continue
      }

      const metadata = await fetchYouTubeVideoMetadata(videoId)

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
        video: { id: video.id, title: video.title },
      })
    } catch (error) {
      console.error(`[youtube import] failed for ${videoId}:`, error)
      results.push({
        videoId,
        success: false,
        error: 'Failed to import video',
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
}

export const POST = withErrorHandling(
  'import YouTube videos',
  withAdminProtection(handleImportVideos)
)
