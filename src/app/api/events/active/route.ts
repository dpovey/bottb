import { NextRequest, NextResponse } from 'next/server'
import { getActiveEvent } from '@/lib/db'
import { withPublicRateLimit } from '@/lib/api-protection'

async function handleGetActiveEvent(_request: NextRequest) {
  try {
    const activeEvent = await getActiveEvent()
    return NextResponse.json(activeEvent)
  } catch (error) {
    console.error('Error fetching active event:', error)
    return NextResponse.json(
      { error: 'Failed to fetch active event' },
      { status: 500 }
    )
  }
}

export const GET = withPublicRateLimit(handleGetActiveEvent)
