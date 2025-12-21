import { NextRequest, NextResponse } from 'next/server'
import { getBandsForEvent } from '@/lib/db'
import { withPublicRateLimit } from '@/lib/api-protection'

async function handleGetBands(request: NextRequest, _context?: unknown) {
  try {
    // Extract eventId from the URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const eventId = pathParts[pathParts.length - 1]

    const bands = await getBandsForEvent(eventId)
    return NextResponse.json(bands)
  } catch (error) {
    console.error('Error fetching bands:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bands' },
      { status: 500 }
    )
  }
}

export const GET = withPublicRateLimit(handleGetBands)
