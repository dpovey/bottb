import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { put } from '@vercel/blob'
import sharp from 'sharp'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'

interface PhotoRow {
  id: string
  blob_url: string
  blob_pathname: string
  original_blob_url: string | null
}

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

const handleCropPhoto: ProtectedApiHandler = async (
  request: NextRequest,
  _context?: unknown
) => {
  try {
    // Extract photoId from URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const photoId = pathParts[pathParts.length - 2] // /api/photos/{photoId}/crop

    if (!photoId) {
      return NextResponse.json(
        { error: 'Photo ID is required' },
        { status: 400 }
      )
    }

    // Parse crop area from request body
    const body = await request.json()
    const cropArea: CropArea = body.cropArea

    if (
      !cropArea ||
      typeof cropArea.x !== 'number' ||
      typeof cropArea.y !== 'number' ||
      typeof cropArea.width !== 'number' ||
      typeof cropArea.height !== 'number'
    ) {
      return NextResponse.json(
        { error: 'Invalid crop area. Required: { x, y, width, height }' },
        { status: 400 }
      )
    }

    // Get photo from database
    const { rows } = await sql<PhotoRow>`
      SELECT id, blob_url, blob_pathname, original_blob_url FROM photos WHERE id = ${photoId}
    `

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    const photo = rows[0]

    // Use original_blob_url if available for best crop quality, otherwise fall back to blob_url (large.webp)
    const sourceImageUrl = photo.original_blob_url || photo.blob_url
    
    // Fetch the source image from blob storage
    const sourceImageResponse = await fetch(sourceImageUrl)
    if (!sourceImageResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch source image' },
        { status: 500 }
      )
    }

    const sourceImageBuffer = Buffer.from(await sourceImageResponse.arrayBuffer())

    // Get source image dimensions
    const metadata = await sharp(sourceImageBuffer).metadata()
    const sourceWidth = metadata.width || 0
    const sourceHeight = metadata.height || 0

    // Convert percentage-based crop coordinates to pixels
    // react-easy-crop returns values as percentages of the image
    const pixelCrop = {
      left: Math.round((cropArea.x / 100) * sourceWidth),
      top: Math.round((cropArea.y / 100) * sourceHeight),
      width: Math.round((cropArea.width / 100) * sourceWidth),
      height: Math.round((cropArea.height / 100) * sourceHeight),
    }

    // Ensure crop is within bounds
    pixelCrop.left = Math.max(
      0,
      Math.min(pixelCrop.left, sourceWidth - pixelCrop.width)
    )
    pixelCrop.top = Math.max(
      0,
      Math.min(pixelCrop.top, sourceHeight - pixelCrop.height)
    )

    // Create new thumbnail with custom crop from source image
    const newThumbnail = await sharp(sourceImageBuffer)
      .extract(pixelCrop)
      .resize(300, 300, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer()

    // Use unique filename to bypass CDN cache
    const timestamp = Date.now()
    const thumbnailPath = `photos/${photoId}/thumbnail-${timestamp}.webp`
    const newThumbnailBlob = await put(thumbnailPath, newThumbnail, {
      access: 'public',
      contentType: 'image/webp',
      addRandomSuffix: false,
    })

    // Store new thumbnail URL in database
    await sql`
      UPDATE photos 
      SET xmp_metadata = jsonb_set(
        jsonb_set(
          COALESCE(xmp_metadata, '{}'::jsonb),
          '{thumbnail_version}',
          ${JSON.stringify(timestamp)}::jsonb
        ),
        '{thumbnail_url}',
        ${JSON.stringify(newThumbnailBlob.url)}::jsonb
      )
      WHERE id = ${photoId}
    `

    return NextResponse.json({
      success: true,
      message: 'Thumbnail cropped successfully',
      thumbnailUrl: newThumbnailBlob.url, // Return the actual new URL (no query params needed)
    })
  } catch (error) {
    console.error('Error cropping photo:', error)
    return NextResponse.json({ error: 'Failed to crop photo' }, { status: 500 })
  }
}

// Only admins can crop photos
export const POST = withAdminProtection(handleCropPhoto)
