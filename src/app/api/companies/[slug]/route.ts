import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/sql'
import { getCompanyBySlug, getCompanyBands } from '@/lib/db'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'

// GET a single company by slug (public)
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 })
    }

    const company = await getCompanyBySlug(slug)
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const bands = await getCompanyBands(slug)
    return NextResponse.json({ company, bands })
  } catch (error) {
    console.error('Error fetching company:', error)
    return NextResponse.json(
      { error: 'Failed to fetch company' },
      { status: 500 }
    )
  }
}

interface CompanyUpdateBody {
  name?: string
  logo_url?: string | null
  website?: string | null
  icon_url?: string | null
  description?: string | null
}

// PATCH - Update a company (admin only)
const handleUpdateCompany: ProtectedApiHandler = async (
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

    const existing = await getCompanyBySlug(slug)
    if (!existing) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const body: CompanyUpdateBody = await request.json()
    const { name, logo_url, website, icon_url, description } = body

    const { rows } = await sql`
      UPDATE companies SET
        name = COALESCE(${name || null}, name),
        logo_url = ${logo_url === undefined ? existing.logo_url : logo_url},
        website = ${website === undefined ? existing.website : website},
        icon_url = ${icon_url === undefined ? existing.icon_url : icon_url},
        description = ${description === undefined ? existing.description : description}
      WHERE slug = ${slug}
      RETURNING *
    `

    return NextResponse.json({ company: rows[0] })
  } catch (error) {
    console.error('Error updating company:', error)
    return NextResponse.json(
      { error: 'Failed to update company' },
      { status: 500 }
    )
  }
}

export const PATCH = withAdminProtection(handleUpdateCompany)

// DELETE - Delete a company (admin only)
const handleDeleteCompany: ProtectedApiHandler = async (
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

    const existing = await getCompanyBySlug(slug)
    if (!existing) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Check if company has bands
    const bands = await getCompanyBands(slug)
    if (bands.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete company "${existing.name}" - it has ${bands.length} band(s) associated. Remove band associations first.`,
          bands: bands.map((b) => ({ id: b.id, name: b.name })),
        },
        { status: 409 }
      )
    }

    // Delete company
    await sql`DELETE FROM companies WHERE slug = ${slug}`

    return NextResponse.json({
      success: true,
      message: `Company "${existing.name}" deleted successfully`,
    })
  } catch (error) {
    console.error('Error deleting company:', error)
    return NextResponse.json(
      { error: 'Failed to delete company' },
      { status: 500 }
    )
  }
}

export const DELETE = withAdminProtection(handleDeleteCompany)
