import { NextRequest, NextResponse } from 'next/server'
import { getUpcomingEvents } from '@/lib/db'
import { withPublicRateLimit } from '@/lib/api-protection'

async function handleGetUpcomingEvents(_request: NextRequest) {
  try {
    const upcomingEvents = await getUpcomingEvents()
    return NextResponse.json(upcomingEvents)
  } catch (error) {
    console.error('Error fetching upcoming events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch upcoming events' },
      { status: 500 }
    )
  }
}

export const GET = withPublicRateLimit(handleGetUpcomingEvents)
