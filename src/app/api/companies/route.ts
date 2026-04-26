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
  withErrorHandling,
  ProtectedApiHandler,
} from '@/lib/api-protection'
import { nameToSlug } from '@/lib/slug-utils'
import { parseBody, companyCreateSchema } from '@/lib/api-schemas'

export const GET = withErrorHandling(
  'fetch companies',
  withPublicRateLimit(async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const slug = searchParams.get('slug')
    const mode = searchParams.get('mode')

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

    if (mode === 'list') {
      const companies = await getDistinctCompanies()
      return NextResponse.json({ companies })
    }

    const companies = await getCompanies()
    return NextResponse.json({ companies })
  })
)

const handleCreateCompany: ProtectedApiHandler = async (
  request: NextRequest
) => {
  const parsed = await parseBody(request, companyCreateSchema)
  if (!parsed.ok) return parsed.response

  const { name, logo_url, website, icon_url } = parsed.data
  const slug = parsed.data.slug || nameToSlug(name)

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
}

export const POST = withErrorHandling(
  'create company',
  withAdminProtection(handleCreateCompany)
)
