import { NextRequest, NextResponse } from 'next/server'
import { getPhotographers, getPhotographerBySlug } from '@/lib/db'
import { sql } from '@/lib/sql'
import {
  withPublicRateLimit,
  withAdminProtection,
  ProtectedApiHandler,
} from '@/lib/api-protection'

export const GET = withPublicRateLimit(async function GET() {
  try {
    const photographers = await getPhotographers()
    return NextResponse.json(photographers)
  } catch (error) {
    console.error('Error fetching photographers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch photographers' },
      { status: 500 }
    )
  }
})

// Helper function to generate slug from name
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

interface PhotographerCreateBody {
  slug?: string
  name: string
  bio?: string | null
  location?: string | null
  website?: string | null
  instagram?: string | null
  email?: string | null
  avatar_url?: string | null
}

// POST - Create a new photographer (admin only)
const handleCreatePhotographer: ProtectedApiHandler = async (
  request: NextRequest
) => {
  try {
    const body: PhotographerCreateBody = await request.json()
    const { name, bio, location, website, instagram, email, avatar_url } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Generate slug from name if not provided
    const slug = body.slug || nameToSlug(name)

    // Check if slug already exists
    const existing = await getPhotographerBySlug(slug)
    if (existing) {
      return NextResponse.json(
        { error: `Photographer with slug "${slug}" already exists` },
        { status: 409 }
      )
    }

    const { rows } = await sql`
      INSERT INTO photographers (slug, name, bio, location, website, instagram, email, avatar_url)
      VALUES (${slug}, ${name}, ${bio || null}, ${location || null}, ${website || null}, ${instagram || null}, ${email || null}, ${avatar_url || null})
      RETURNING *
    `

    return NextResponse.json({ photographer: rows[0] }, { status: 201 })
  } catch (error) {
    console.error('Error creating photographer:', error)
    return NextResponse.json(
      { error: 'Failed to create photographer' },
      { status: 500 }
    )
  }
}

export const POST = withAdminProtection(handleCreatePhotographer)
