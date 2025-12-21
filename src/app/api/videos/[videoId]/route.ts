import { NextRequest, NextResponse } from 'next/server'
import { getVideoById, updateVideo, deleteVideo } from '@/lib/db'
import { withAdminAuth, ProtectedApiHandler } from '@/lib/api-protection'

interface RouteContext {
  params: Promise<{ videoId: string }>
}

/**
 * GET /api/videos/[videoId]
 * Public endpoint to get a single video
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { videoId } = await context.params
    const video = await getVideoById(videoId)

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    return NextResponse.json({ video })
  } catch (error) {
    console.error('Error fetching video:', error)
    return NextResponse.json(
      { error: 'Failed to fetch video' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/videos/[videoId]
 * Admin endpoint to update a video
 */
const patchHandler: ProtectedApiHandler = async (request, context) => {
  try {
    const { videoId } = await (context as RouteContext).params
    const body = await request.json()
    const { title, eventId, bandId, sortOrder } = body

    const existing = await getVideoById(videoId)
    if (!existing) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    await updateVideo(videoId, {
      title,
      event_id: eventId,
      band_id: bandId,
      sort_order: sortOrder,
    })

    // Fetch the video with joined fields (event_name, band_name, etc.)
    const video = await getVideoById(videoId)

    return NextResponse.json({ video })
  } catch (error) {
    console.error('Error updating video:', error)
    return NextResponse.json(
      { error: 'Failed to update video' },
      { status: 500 }
    )
  }
}

export const PATCH = withAdminAuth(patchHandler)

/**
 * DELETE /api/videos/[videoId]
 * Admin endpoint to delete a video
 */
const deleteHandler: ProtectedApiHandler = async (_request, context) => {
  try {
    const { videoId } = await (context as RouteContext).params

    const existing = await getVideoById(videoId)
    if (!existing) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    await deleteVideo(videoId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting video:', error)
    return NextResponse.json(
      { error: 'Failed to delete video' },
      { status: 500 }
    )
  }
}

export const DELETE = withAdminAuth(deleteHandler)
