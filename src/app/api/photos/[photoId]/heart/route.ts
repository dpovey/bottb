import { NextRequest, NextResponse } from 'next/server'
import { togglePhotoHeart, hasHeartedPhoto } from '@/lib/db'
import { extractUserContext } from '@/lib/user-context-server'
import { withPublicRateLimit } from '@/lib/api-protection'

/**
 * Resolve a stable-ish key identifying an anonymous visitor for heart dedup.
 * Prefers the FingerprintJS visitor id (stable across sessions); falls back to
 * the server-side vote fingerprint when FingerprintJS is unavailable.
 */
function resolveVisitorKey(
  request: NextRequest,
  fingerprintjsVisitorId?: unknown
): string {
  if (
    typeof fingerprintjsVisitorId === 'string' &&
    fingerprintjsVisitorId.length > 0
  ) {
    return `fpjs:${fingerprintjsVisitorId}`
  }
  return `fp:${extractUserContext(request).vote_fingerprint}`
}

async function getParams(
  context: unknown
): Promise<{ photoId: string } | null> {
  const params = (context as { params?: Promise<{ photoId: string }> })?.params
  if (!params) return null
  return params
}

/**
 * GET — return the current heart state for this visitor (hearted + count).
 * Used to hydrate the heart button on load.
 */
async function handleGet(request: NextRequest, context?: unknown) {
  const params = await getParams(context)
  const photoId = params?.photoId
  if (!photoId) {
    return NextResponse.json({ error: 'Photo ID is required' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const visitorKey = resolveVisitorKey(
    request,
    searchParams.get('fingerprintjs_visitor_id') ?? undefined
  )

  const hearted = await hasHeartedPhoto(photoId, visitorKey)
  return NextResponse.json({ hearted })
}

/**
 * POST — toggle this visitor's heart on the photo. Returns the new state and
 * the updated public heart count.
 */
async function handlePost(request: NextRequest, context?: unknown) {
  const params = await getParams(context)
  const photoId = params?.photoId
  if (!photoId) {
    return NextResponse.json({ error: 'Photo ID is required' }, { status: 400 })
  }

  let fingerprintjsVisitorId: unknown
  try {
    const body = await request.json()
    fingerprintjsVisitorId = body?.fingerprintjs_visitor_id
  } catch {
    // No/invalid body is fine — fall back to the server fingerprint.
  }

  const visitorKey = resolveVisitorKey(request, fingerprintjsVisitorId)

  try {
    const result = await togglePhotoHeart(photoId, visitorKey)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'Failed to toggle heart' },
      { status: 500 }
    )
  }
}

export const GET = withPublicRateLimit(handleGet)
export const POST = withPublicRateLimit(handlePost)
