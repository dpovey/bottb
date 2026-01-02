import { NextRequest, NextResponse } from 'next/server'
import { getPhotoCrop } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Extract photoId from URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const photoId = pathParts[pathParts.length - 2] // /api/photos/{photoId}/smart-crop

    if (!photoId) {
      return NextResponse.json(
        { error: 'Photo ID is required' },
        { status: 400 }
      )
    }

    // Get aspect ratio from query params (default to 4:5 for Instagram)
    const aspectRatio = url.searchParams.get('aspect') || '4:5'

    // Get smart crop from database
    const crop = await getPhotoCrop(photoId, aspectRatio)

    if (!crop) {
      return NextResponse.json(
        {
          error: 'Smart crop not found',
          message: `No smart crop available for aspect ratio ${aspectRatio}. Photo may not have been processed yet.`,
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      photo_id: photoId,
      aspect_ratio: aspectRatio,
      crop_box: crop.crop_box,
      confidence: crop.confidence,
      method: crop.method,
      created_at: crop.created_at,
    })
  } catch (error) {
    console.error('Error fetching smart crop:', error)
    return NextResponse.json(
      { error: 'Failed to fetch smart crop' },
      { status: 500 }
    )
  }
}
