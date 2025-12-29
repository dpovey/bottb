import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/sql'
import { getPhotographerBySlug, getPhotoCount } from '@/lib/db'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'

// GET a single photographer by slug (public)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const photographer = await getPhotographerBySlug(slug)

    if (!photographer) {
      return NextResponse.json(
        { error: 'Photographer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(photographer)
  } catch (error) {
    console.error('Error fetching photographer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch photographer' },
      { status: 500 }
    )
  }
}

interface PhotographerUpdateBody {
  name?: string
  bio?: string | null
  location?: string | null
  website?: string | null
  instagram?: string | null
  email?: string | null
  avatar_url?: string | null
}

// PATCH - Update a photographer (admin only)
const handleUpdatePhotographer: ProtectedApiHandler = async (
  request: NextRequest,
  _context?: unknown
) => {
  try {
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const slug = pathParts[pathParts.length - 1]

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 })
    }

    const existing = await getPhotographerBySlug(slug)
    if (!existing) {
      return NextResponse.json(
        { error: 'Photographer not found' },
        { status: 404 }
      )
    }

    const body: PhotographerUpdateBody = await request.json()
    const { name, bio, location, website, instagram, email, avatar_url } = body

    const { rows } = await sql`
      UPDATE photographers SET
        name = COALESCE(${name || null}, name),
        bio = ${bio === undefined ? existing.bio : bio},
        location = ${location === undefined ? existing.location : location},
        website = ${website === undefined ? existing.website : website},
        instagram = ${instagram === undefined ? existing.instagram : instagram},
        email = ${email === undefined ? existing.email : email},
        avatar_url = ${avatar_url === undefined ? existing.avatar_url : avatar_url}
      WHERE slug = ${slug}
      RETURNING *
    `

    return NextResponse.json({ photographer: rows[0] })
  } catch (error) {
    console.error('Error updating photographer:', error)
    return NextResponse.json(
      { error: 'Failed to update photographer' },
      { status: 500 }
    )
  }
}

export const PATCH = withAdminProtection(handleUpdatePhotographer)

// DELETE - Delete a photographer (admin only)
const handleDeletePhotographer: ProtectedApiHandler = async (
  request: NextRequest,
  _context?: unknown
) => {
  try {
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const slug = pathParts[pathParts.length - 1]

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 })
    }

    const existing = await getPhotographerBySlug(slug)
    if (!existing) {
      return NextResponse.json(
        { error: 'Photographer not found' },
        { status: 404 }
      )
    }

    // Check if photographer has photos
    const photoCount = await getPhotoCount({ photographer: existing.name })
    if (photoCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete photographer "${existing.name}" - they have ${photoCount} photo(s) associated. Remove photo associations first.`,
          photoCount,
        },
        { status: 409 }
      )
    }

    // Delete photographer
    await sql`DELETE FROM photographers WHERE slug = ${slug}`

    return NextResponse.json({
      success: true,
      message: `Photographer "${existing.name}" deleted successfully`,
    })
  } catch (error) {
    console.error('Error deleting photographer:', error)
    return NextResponse.json(
      { error: 'Failed to delete photographer' },
      { status: 500 }
    )
  }
}

export const DELETE = withAdminProtection(handleDeletePhotographer)
