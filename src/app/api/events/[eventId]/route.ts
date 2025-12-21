import { NextRequest, NextResponse } from 'next/server'
import { getEventById } from '@/lib/db'
import { withPublicRateLimit } from '@/lib/api-protection'

async function handleGetEvent(request: NextRequest, _context?: unknown) {
  try {
    // Extract eventId from the URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const eventId = pathParts[pathParts.length - 1]

    const event = await getEventById(eventId)

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error('Error fetching event:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withPublicRateLimit(handleGetEvent)
