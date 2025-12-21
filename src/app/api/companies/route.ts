import { NextRequest, NextResponse } from 'next/server'
import {
  getCompanies,
  getDistinctCompanies,
  getCompanyBySlug,
  getCompanyBands,
} from '@/lib/db'

export async function GET(request: NextRequest) {
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
}
