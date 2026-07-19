import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/sql'
import { getVideographerBySlug, setVideographerEvents } from '@/lib/db'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'

// GET a single videographer by slug (public)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const videographer = await getVideographerBySlug(slug)

    if (!videographer) {
      return NextResponse.json(
        { error: 'Videographer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(videographer)
  } catch (error) {
    console.error('Error fetching videographer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch videographer' },
      { status: 500 }
    )
  }
}

interface VideographerUpdateBody {
  name?: string
  bio?: string | null
  location?: string | null
  website?: string | null
  instagram?: string | null
  email?: string | null
  avatar_url?: string | null
  event_ids?: string[]
}

// PATCH - Update a videographer (admin only)
const handleUpdateVideographer: ProtectedApiHandler = async (
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

    const existing = await getVideographerBySlug(slug)
    if (!existing) {
      return NextResponse.json(
        { error: 'Videographer not found' },
        { status: 404 }
      )
    }

    const body: VideographerUpdateBody = await request.json()
    const { name, bio, location, website, instagram, email, avatar_url } = body

    const { rows } = await sql`
      UPDATE videographers SET
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

    if (body.event_ids !== undefined) {
      await setVideographerEvents(slug, body.event_ids)
    }

    return NextResponse.json({ videographer: rows[0] })
  } catch (error) {
    console.error('Error updating videographer:', error)
    return NextResponse.json(
      { error: 'Failed to update videographer' },
      { status: 500 }
    )
  }
}

export const PATCH = withAdminProtection(handleUpdateVideographer)

// DELETE - Delete a videographer (admin only).
// Event associations are removed automatically via ON DELETE CASCADE.
const handleDeleteVideographer: ProtectedApiHandler = async (
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

    const existing = await getVideographerBySlug(slug)
    if (!existing) {
      return NextResponse.json(
        { error: 'Videographer not found' },
        { status: 404 }
      )
    }

    await sql`DELETE FROM videographers WHERE slug = ${slug}`

    return NextResponse.json({
      success: true,
      message: `Videographer "${existing.name}" deleted successfully`,
    })
  } catch (error) {
    console.error('Error deleting videographer:', error)
    return NextResponse.json(
      { error: 'Failed to delete videographer' },
      { status: 500 }
    )
  }
}

export const DELETE = withAdminProtection(handleDeleteVideographer)
