import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'
import { bulkSetPhotosVisibility, type PhotoVisibility } from '@/lib/db'

/**
 * POST /api/admin/photos/visibility
 * Bulk-set the visibility of every photo for an event and/or photographer.
 * Used to release all photos at once ("make all public") after dripping a
 * few out individually.
 *
 * Body:
 * - visibility: 'private' | 'public' (required)
 * - eventId?: string
 * - photographer?: string
 *
 * At least one of eventId / photographer must be provided.
 */
const handleSetVisibility: ProtectedApiHandler = async (
  request: NextRequest,
  _context?: unknown
) => {
  try {
    const body = await request.json()
    const visibility = body.visibility as PhotoVisibility | undefined
    const eventId =
      typeof body.eventId === 'string' && body.eventId
        ? body.eventId
        : undefined
    const photographer =
      typeof body.photographer === 'string' && body.photographer
        ? body.photographer
        : undefined

    if (visibility !== 'private' && visibility !== 'public') {
      return NextResponse.json(
        { error: "visibility must be 'private' or 'public'" },
        { status: 400 }
      )
    }

    if (!eventId && !photographer) {
      return NextResponse.json(
        { error: 'An eventId or photographer scope is required' },
        { status: 400 }
      )
    }

    const updated = await bulkSetPhotosVisibility(
      { eventId, photographer },
      visibility
    )

    // Gallery/listing caches need to reflect the newly released (or hidden) photos.
    revalidateTag('photos', 'fifteenMinutes')
    revalidateTag('photo-filters', 'fifteenMinutes')

    return NextResponse.json({
      success: true,
      updated,
      visibility,
      message: `Set ${updated} photo${updated === 1 ? '' : 's'} to ${visibility}`,
    })
  } catch (error) {
    console.error('Error bulk-updating photo visibility:', error)
    return NextResponse.json(
      { error: 'Failed to update photo visibility' },
      { status: 500 }
    )
  }
}

export const POST = withAdminProtection(handleSetVisibility)
