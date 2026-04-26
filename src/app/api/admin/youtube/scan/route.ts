/**
 * YouTube Channel Scan API
 *
 * GET /api/admin/youtube/scan - Scan channel for new videos
 *
 * Query params:
 * - maxResults: Maximum videos to fetch (default 50)
 * - includeExisting: Include videos already in DB (default false)
 *
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  withAdminProtection,
  withErrorHandling,
  ProtectedApiHandler,
} from '@/lib/api-protection'
import { fetchAllChannelVideos, getChannelHandle } from '@/lib/youtube-api'
import { matchVideosToDatabase } from '@/lib/video-matcher'
import { getVideos } from '@/lib/db'

const handleScanChannel: ProtectedApiHandler = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const maxResults = parseInt(searchParams.get('maxResults') || '50', 10)
  const includeExisting = searchParams.get('includeExisting') === 'true'

  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json(
      { error: 'YouTube API key not configured' },
      { status: 500 }
    )
  }

  const channelResult = await fetchAllChannelVideos(undefined, maxResults)

  if (!channelResult) {
    return NextResponse.json(
      {
        error:
          'Failed to fetch channel videos. Check YouTube API key and channel configuration.',
      },
      { status: 500 }
    )
  }

  const existingVideos = await getVideos({ limit: 1000 })
  const existingVideoIds = new Set(
    existingVideos.map((v) => v.youtube_video_id)
  )

  let videosToMatch = channelResult.videos
  if (!includeExisting) {
    videosToMatch = videosToMatch.filter(
      (v) => !existingVideoIds.has(v.videoId)
    )
  }

  const matchResults = await matchVideosToDatabase(videosToMatch)

  const confidenceOrder = { high: 0, medium: 1, low: 2, none: 3 }
  matchResults.sort((a, b) => {
    const confDiff =
      confidenceOrder[a.confidence] - confidenceOrder[b.confidence]
    if (confDiff !== 0) return confDiff
    return (
      new Date(b.video.publishedAt).getTime() -
      new Date(a.video.publishedAt).getTime()
    )
  })

  return NextResponse.json({
    channelHandle: getChannelHandle(),
    channelTitle: channelResult.channelTitle,
    totalOnChannel: channelResult.totalResults,
    totalFetched: channelResult.videos.length,
    totalNew: videosToMatch.length,
    totalInDatabase: existingVideoIds.size,
    videos: matchResults.map((result) => ({
      videoId: result.video.videoId,
      title: result.video.title,
      description: result.video.description,
      publishedAt: result.video.publishedAt,
      thumbnailUrl: result.video.thumbnailUrl,
      isShort: result.video.isShort,
      alreadyInDatabase: existingVideoIds.has(result.video.videoId),
      suggestedTitle: result.suggestedTitle,
      matchConfidence: result.confidence,
      eventMatch: result.eventMatch.id
        ? {
            id: result.eventMatch.id,
            name: result.eventMatch.name,
            confidence: result.eventMatch.confidence,
          }
        : null,
      bandMatch: result.bandMatch.id
        ? {
            id: result.bandMatch.id,
            name: result.bandMatch.name,
            confidence: result.bandMatch.confidence,
          }
        : null,
    })),
  })
}

export const GET = withErrorHandling(
  'scan YouTube channel',
  withAdminProtection(handleScanChannel)
)
