import { NextRequest, NextResponse } from 'next/server'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'
import {
  updatePhotoLabels,
  updateHeroFocalPoint,
  getPhotoById,
  PHOTO_LABELS,
  PhotoLabel,
  HeroFocalPoint,
} from '@/lib/db'

// Valid labels
const VALID_LABELS = new Set(Object.values(PHOTO_LABELS))

function validateLabels(labels: unknown): labels is string[] {
  if (!Array.isArray(labels)) return false
  return labels.every(
    (label) =>
      typeof label === 'string' && VALID_LABELS.has(label as PhotoLabel)
  )
}

function validateFocalPoint(focalPoint: unknown): focalPoint is HeroFocalPoint {
  if (typeof focalPoint !== 'object' || focalPoint === null) return false
  const fp = focalPoint as Record<string, unknown>
  return (
    typeof fp.x === 'number' &&
    typeof fp.y === 'number' &&
    fp.x >= 0 &&
    fp.x <= 100 &&
    fp.y >= 0 &&
    fp.y <= 100
  )
}

// GET - Get photo labels and focal point
export async function GET(
  request: NextRequest,
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

    return NextResponse.json({
      photoId: photo.id,
      labels: photo.labels || [],
      heroFocalPoint: photo.hero_focal_point || { x: 50, y: 50 },
      availableLabels: Object.values(PHOTO_LABELS),
    })
  } catch (error) {
    console.error('Error fetching photo labels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch photo labels' },
      { status: 500 }
    )
  }
}

// PATCH - Update photo labels and/or focal point (admin only)
const handleUpdateLabels: ProtectedApiHandler = async (
  request: NextRequest,
  context?: unknown
) => {
  try {
    const params = context as { params: Promise<{ photoId: string }> }
    const { photoId } = await params.params

    if (!photoId) {
      return NextResponse.json(
        { error: 'Photo ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { labels, heroFocalPoint } = body

    let updatedPhoto = null

    // Update labels if provided
    if (labels !== undefined) {
      if (!validateLabels(labels)) {
        return NextResponse.json(
          {
            error: 'Invalid labels. Must be an array of valid label strings.',
            validLabels: Object.values(PHOTO_LABELS),
          },
          { status: 400 }
        )
      }
      updatedPhoto = await updatePhotoLabels(photoId, labels)
    }

    // Update focal point if provided
    if (heroFocalPoint !== undefined) {
      if (!validateFocalPoint(heroFocalPoint)) {
        return NextResponse.json(
          {
            error: 'Invalid focal point. Must be {x: 0-100, y: 0-100}.',
          },
          { status: 400 }
        )
      }
      updatedPhoto = await updateHeroFocalPoint(photoId, heroFocalPoint)
    }

    // If neither was provided, just fetch the current photo
    if (!updatedPhoto) {
      updatedPhoto = await getPhotoById(photoId)
    }

    if (!updatedPhoto) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      photoId: updatedPhoto.id,
      labels: updatedPhoto.labels,
      heroFocalPoint: updatedPhoto.hero_focal_point || { x: 50, y: 50 },
    })
  } catch (error) {
    console.error('Error updating photo:', error)
    return NextResponse.json(
      { error: 'Failed to update photo' },
      { status: 500 }
    )
  }
}

export const PATCH = withAdminProtection(handleUpdateLabels)
