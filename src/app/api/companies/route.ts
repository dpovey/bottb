import { NextRequest, NextResponse } from 'next/server'
import {
  getCompanies,
  getDistinctCompanies,
  getCompanyBySlug,
  getCompanyBands,
} from '@/lib/db'
import { sql } from '@/lib/sql'
import {
  withPublicRateLimit,
  withAdminProtection,
  ProtectedApiHandler,
} from '@/lib/api-protection'

export const GET = withPublicRateLimit(async function GET(
  request: NextRequest
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const slug = searchParams.get('slug')
    const mode = searchParams.get('mode') // "list" for simple list, "full" for full details

    // If a specific slug is requested, return that company with its bands
    if (slug) {
      const company = await getCompanyBySlug(slug)
      if (!company) {
        return NextResponse.json(
          { error: 'Company not found' },
          { status: 404 }
        )
      }

      const bands = await getCompanyBands(slug)
      return NextResponse.json({ company, bands })
    }

    // If mode is "list", return simple list for dropdowns
    if (mode === 'list') {
      const companies = await getDistinctCompanies()
      return NextResponse.json({ companies })
    }

    // Otherwise return all companies with stats
    const companies = await getCompanies()
    return NextResponse.json({ companies })
  } catch (error) {
    console.error('Error fetching companies:', error)
    return NextResponse.json(
      { error: 'Failed to fetch companies' },
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

interface CompanyCreateBody {
  slug?: string
  name: string
  logo_url?: string | null
  website?: string | null
  icon_url?: string | null
}

// POST - Create a new company (admin only)
const handleCreateCompany: ProtectedApiHandler = async (
  request: NextRequest
) => {
  try {
    const body: CompanyCreateBody = await request.json()
    const { name, logo_url, website, icon_url } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Generate slug from name if not provided
    const slug = body.slug || nameToSlug(name)

    // Check if slug already exists
    const existing = await getCompanyBySlug(slug)
    if (existing) {
      return NextResponse.json(
        { error: `Company with slug "${slug}" already exists` },
        { status: 409 }
      )
    }

    const { rows } = await sql`
      INSERT INTO companies (slug, name, logo_url, website, icon_url)
      VALUES (${slug}, ${name}, ${logo_url || null}, ${website || null}, ${icon_url || null})
      RETURNING *
    `

    return NextResponse.json({ company: rows[0] }, { status: 201 })
  } catch (error) {
    console.error('Error creating company:', error)
    return NextResponse.json(
      { error: 'Failed to create company' },
      { status: 500 }
    )
  }
}

export const POST = withAdminProtection(handleCreateCompany)
