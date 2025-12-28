import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/sql'
import { del, list } from '@vercel/blob'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'
import { getPhotoById } from '@/lib/db'

interface PhotoRow {
  id: string
  blob_url: string
  blob_pathname: string
  original_filename: string
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
