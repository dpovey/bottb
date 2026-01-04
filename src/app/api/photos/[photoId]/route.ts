import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { sql } from '@/lib/sql'
import { del, list } from '@vercel/blob'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'
import { getPhotoById, Photo } from '@/lib/db'

interface PhotoRow {
  id: string
  blob_url: string
  blob_pathname: string
  original_filename: string
}

interface PhotoUpdateBody {
  event_id?: string | null
  band_id?: string | null
  photographer?: string | null
}

// GET a single photo by ID (public endpoint for slideshow deep links)
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ photoId: string }> }
) {
  try {
    const { photoId } = await context.params

    if (!photoId) {
      return NextResponse.json(
        { error: 'Photo ID is required' },
        { status: 400 }
      )
    }

    const photo = await getPhotoById(photoId)

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    return NextResponse.json(photo)
  } catch (error) {
    console.error('Error fetching photo:', error)
    return NextResponse.json(
      { error: 'Failed to fetch photo' },
      { status: 500 }
    )
  }
}

const handleDeletePhoto: ProtectedApiHandler = async (
  request: NextRequest,
  _context?: unknown
) => {
  try {
    // Extract photoId from URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const photoId = pathParts[pathParts.length - 1]

    if (!photoId) {
      return NextResponse.json(
        { error: 'Photo ID is required' },
        { status: 400 }
      )
    }

    // Get photo from database to find blob paths
    const { rows } = await sql<PhotoRow>`
      SELECT id, blob_url, blob_pathname, original_filename 
      FROM photos WHERE id = ${photoId}
    `

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    const photo = rows[0]

    // Extract the photo folder path to delete all variants
    // blob_pathname format: photos/{photoId}/large.webp
    const pathSegments = photo.blob_pathname.split('/')
    const photoFolder = pathSegments.slice(0, 2).join('/') // photos/{photoId}

    // Delete all blobs in this photo's folder (thumbnail + large)
    try {
      const blobList = await list({ prefix: `${photoFolder}/` })
      for (const blob of blobList.blobs) {
        await del(blob.url)
      }
    } catch (blobError) {
      console.error('Error deleting blobs:', blobError)
      // Continue with database deletion even if blob deletion fails
    }

    // Delete database record
    await sql`DELETE FROM photos WHERE id = ${photoId}`

    // Revalidate photo caches
    revalidateTag('photos', 'fifteenMinutes')

    return NextResponse.json({
      success: true,
      message: `Photo "${photo.original_filename}" deleted successfully`,
      deletedId: photoId,
    })
  } catch (error) {
    console.error('Error deleting photo:', error)
    return NextResponse.json(
      { error: 'Failed to delete photo' },
      { status: 500 }
    )
  }
}

// Only admins can delete photos
export const DELETE = withAdminProtection(handleDeletePhoto)

// PATCH - Update photo metadata (event_id, band_id, photographer)
const handleUpdatePhoto: ProtectedApiHandler = async (
  request: NextRequest,
  _context?: unknown
) => {
  try {
    // Extract photoId from URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const photoId = pathParts[pathParts.length - 1]

    if (!photoId) {
      return NextResponse.json(
        { error: 'Photo ID is required' },
        { status: 400 }
      )
    }

    // Check if photo exists
    const existingPhoto = await getPhotoById(photoId)
    if (!existingPhoto) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    const body: PhotoUpdateBody = await request.json()
    const { event_id, band_id, photographer } = body

    // Validate that at least one field is being updated
    if (
      event_id === undefined &&
      band_id === undefined &&
      photographer === undefined
    ) {
      return NextResponse.json(
        {
          error:
            'At least one field (event_id, band_id, photographer) must be provided',
        },
        { status: 400 }
      )
    }

    // Validate foreign keys if provided
    if (event_id !== undefined && event_id !== null) {
      const { rows: eventRows } = await sql<{ id: string }>`
        SELECT id FROM events WHERE id = ${event_id}
      `
      if (eventRows.length === 0) {
        return NextResponse.json(
          { error: `Event with id "${event_id}" not found` },
          { status: 400 }
        )
      }
    }

    if (band_id !== undefined && band_id !== null) {
      const { rows: bandRows } = await sql<{ id: string }>`
        SELECT id FROM bands WHERE id = ${band_id}
      `
      if (bandRows.length === 0) {
        return NextResponse.json(
          { error: `Band with id "${band_id}" not found` },
          { status: 400 }
        )
      }
    }

    // Execute update - preserve existing values for fields not being updated
    // Set match_confidence to 'manual' since this is a manual correction
    const { rows } = await sql<Photo>`
      UPDATE photos SET
        event_id = ${event_id !== undefined ? event_id : existingPhoto.event_id},
        band_id = ${band_id !== undefined ? band_id : existingPhoto.band_id},
        photographer = ${photographer !== undefined ? photographer : existingPhoto.photographer},
        match_confidence = 'manual'
      WHERE id = ${photoId}
      RETURNING *
    `

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to update photo' },
        { status: 500 }
      )
    }

    // Fetch the updated photo with joined fields
    const updatedPhoto = await getPhotoById(photoId)

    // Revalidate photo caches so gallery shows updated metadata
    revalidateTag('photos', 'fifteenMinutes')

    return NextResponse.json({
      success: true,
      photo: updatedPhoto,
    })
  } catch (error) {
    console.error('Error updating photo:', error)
    return NextResponse.json(
      { error: 'Failed to update photo' },
      { status: 500 }
    )
  }
}

// Only admins can update photo metadata
export const PATCH = withAdminProtection(handleUpdatePhoto)
