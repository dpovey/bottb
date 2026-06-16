import { NextRequest, NextResponse } from 'next/server'
import { incrementPhotoDownloadCount } from '@/lib/db'
import { withPublicRateLimit } from '@/lib/api-protection'

/**
 * POST — record a download of the photo by incrementing its persistent
 * download counter. Downloads are not deduped (every download counts); this is
 * an admin-only metric surfaced alongside the public heart count.
 *
 * Fired alongside the existing PostHog `photo:download` analytics event, so a
 * failure here must never block the actual download — callers treat it as
 * fire-and-forget.
 */
async function handlePost(_request: NextRequest, context?: unknown) {
  const params = await (context as { params?: Promise<{ photoId: string }> })
    ?.params
  const photoId = params?.photoId
  if (!photoId) {
    return NextResponse.json({ error: 'Photo ID is required' }, { status: 400 })
  }

  try {
    const downloadCount = await incrementPhotoDownloadCount(photoId)
    return NextResponse.json({ download_count: downloadCount })
  } catch {
    return NextResponse.json(
      { error: 'Failed to record download' },
      { status: 500 }
    )
  }
}

export const POST = withPublicRateLimit(handlePost)
