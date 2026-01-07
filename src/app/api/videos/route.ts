import { NextRequest, NextResponse } from 'next/server'
import {
  getVideos,
  getVideoCount,
  createVideo,
  getVideoById,
  getVideoByYoutubeId,
} from '@/lib/db'
import { withAdminAuth, ProtectedApiHandler } from '@/lib/api-protection'

import { withPublicRateLimit } from '@/lib/api-protection'

/**
 * GET /api/videos
 * Public endpoint to list videos with optional filters
 */
export const GET = withPublicRateLimit(async function GET(
  request: NextRequest
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const eventId = searchParams.get('event') || undefined
    const companySlug = searchParams.get('company') || undefined
    const videoTypeParam = searchParams.get('type')
    const videoType =
      videoTypeParam === 'video' || videoTypeParam === 'short'
        ? videoTypeParam
        : undefined
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = (page - 1) * limit

    const [videos, total] = await Promise.all([
      getVideos({ eventId, companySlug, videoType, limit, offset }),
      getVideoCount({ eventId, companySlug, videoType }),
    ])

    return NextResponse.json({
      videos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching videos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch videos' },
      { status: 500 }
    )
  }
})

/**
 * Extract YouTube video ID from various URL formats
 */
function extractYoutubeVideoId(input: string): string | null {
  // If it's already just an ID (11 characters)
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input
  }

  // Try various YouTube URL patterns
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = input.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

/**
 * Parse ISO 8601 duration to seconds (e.g., PT3M33S -> 213)
 * Reserved for future use with YouTube API metadata fetching
 */
function _parseDuration(duration: string): number | null {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return null

  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)

  return hours * 3600 + minutes * 60 + seconds
}

/**
 * Detect if URL is a YouTube Short
 */
function isYoutubeShort(url: string): boolean {
  return url.includes('/shorts/')
}

/**
 * POST /api/videos
 * Admin endpoint to create a new video
 */
const postHandler: ProtectedApiHandler = async (request) => {
  try {
    const body = await request.json()
    const { youtubeUrl, title, eventId, bandId, sortOrder, videoType } = body

    if (!youtubeUrl) {
      return NextResponse.json(
        { error: 'YouTube URL or video ID is required' },
        { status: 400 }
      )
    }

    // Extract video ID from URL
    const youtubeVideoId = extractYoutubeVideoId(youtubeUrl)
    if (!youtubeVideoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL or video ID' },
        { status: 400 }
      )
    }

    // Check if video already exists
    const existing = await getVideoByYoutubeId(youtubeVideoId)
    if (existing) {
      return NextResponse.json(
        { error: 'Video already exists', video: existing },
        { status: 409 }
      )
    }

    // Auto-detect video type from URL if not explicitly provided
    const detectedType =
      videoType === 'video' || videoType === 'short'
        ? videoType
        : isYoutubeShort(youtubeUrl)
          ? 'short'
          : 'video'

    // Use provided title or generate thumbnail URL
    // YouTube thumbnails: hq720.jpg is more reliable and provides good quality (1280x720)
    const thumbnailUrl = `https://i.ytimg.com/vi/${youtubeVideoId}/hq720.jpg`

    // Create the video
    const createdVideo = await createVideo({
      youtube_video_id: youtubeVideoId,
      title: title || `Video ${youtubeVideoId}`,
      event_id: eventId || null,
      band_id: bandId || null,
      duration_seconds: null,
      thumbnail_url: thumbnailUrl,
      published_at: null,
      sort_order: sortOrder ?? 0,
      video_type: detectedType,
    })

    // Fetch the video with joined fields (event_name, band_name, etc.)
    const video = await getVideoById(createdVideo.id)

    return NextResponse.json({ video }, { status: 201 })
  } catch (error) {
    console.error('Error creating video:', error)
    return NextResponse.json(
      { error: 'Failed to create video' },
      { status: 500 }
    )
  }
}

export const POST = withAdminAuth(postHandler)
