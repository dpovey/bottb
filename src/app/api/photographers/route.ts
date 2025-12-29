import { NextResponse } from 'next/server'
import { getPhotographers } from '@/lib/db'
import { withPublicRateLimit } from '@/lib/api-protection'

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
