import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/sql'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'
import { Band } from '@/lib/db-types'

// GET a single band by ID (public)
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ bandId: string }> }
) {
  try {
    const { bandId } = await context.params

    if (!bandId) {
      return NextResponse.json(
        { error: 'Band ID is required' },
        { status: 400 }
      )
    }

    const { rows } = await sql<Band>`
      SELECT b.*, c.name as company_name
      FROM bands b
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE b.id = ${bandId}
    `

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Band not found' }, { status: 404 })
    }

    return NextResponse.json({ band: rows[0] })
  } catch (error) {
    console.error('Error fetching band:', error)
    return NextResponse.json({ error: 'Failed to fetch band' }, { status: 500 })
  }
}

interface BandUpdateBody {
  name?: string
  description?: string | null
  company_slug?: string | null
  order?: number
  info?: Record<string, unknown>
}

// PATCH - Update a band (admin only)
const handleUpdateBand: ProtectedApiHandler = async (
  request: NextRequest,
  _context?: unknown
) => {
  try {
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const bandId = pathParts[pathParts.length - 1]

    if (!bandId) {
      return NextResponse.json(
        { error: 'Band ID is required' },
        { status: 400 }
      )
    }

    // Check if band exists
    const { rows: existing } = await sql<Band>`
      SELECT * FROM bands WHERE id = ${bandId}
    `
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Band not found' }, { status: 404 })
    }

    const band = existing[0]
    const body: BandUpdateBody = await request.json()
    const { name, description, company_slug, order, info } = body

    const { rows } = await sql<Band>`
      UPDATE bands SET
        name = COALESCE(${name || null}, name),
        description = ${description === undefined ? band.description : description},
        company_slug = ${company_slug === undefined ? band.company_slug : company_slug},
        "order" = COALESCE(${order ?? null}, "order"),
        info = ${info ? JSON.stringify(info) : band.info}
      WHERE id = ${bandId}
      RETURNING *
    `

    return NextResponse.json({ band: rows[0] })
  } catch (error) {
    console.error('Error updating band:', error)
    return NextResponse.json(
      { error: 'Failed to update band' },
      { status: 500 }
    )
  }
}

export const PATCH = withAdminProtection(handleUpdateBand)

// DELETE - Delete a band (admin only)
const handleDeleteBand: ProtectedApiHandler = async (
  request: NextRequest,
  _context?: unknown
) => {
  try {
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const bandId = pathParts[pathParts.length - 1]

    if (!bandId) {
      return NextResponse.json(
        { error: 'Band ID is required' },
        { status: 400 }
      )
    }

    // Check if band exists
    const { rows: existing } = await sql<Band & { name: string }>`
      SELECT * FROM bands WHERE id = ${bandId}
    `
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Band not found' }, { status: 404 })
    }

    const band = existing[0]

    // Check for associated data
    const { rows: votes } = await sql<{ count: string }>`
      SELECT COUNT(*) as count FROM votes WHERE band_id = ${bandId}
    `
    const voteCount = parseInt(votes[0]?.count || '0', 10)

    const { rows: photos } = await sql<{ count: string }>`
      SELECT COUNT(*) as count FROM photos WHERE band_id = ${bandId}
    `
    const photoCount = parseInt(photos[0]?.count || '0', 10)

    if (voteCount > 0 || photoCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete band "${band.name}" - it has ${voteCount} vote(s) and ${photoCount} photo(s) associated. Remove associations first.`,
          voteCount,
          photoCount,
        },
        { status: 409 }
      )
    }

    // Delete setlist songs first
    await sql`DELETE FROM setlist_songs WHERE band_id = ${bandId}`

    // Delete band
    await sql`DELETE FROM bands WHERE id = ${bandId}`

    return NextResponse.json({
      success: true,
      message: `Band "${band.name}" deleted successfully`,
    })
  } catch (error) {
    console.error('Error deleting band:', error)
    return NextResponse.json(
      { error: 'Failed to delete band' },
      { status: 500 }
    )
  }
}

export const DELETE = withAdminProtection(handleDeleteBand)
