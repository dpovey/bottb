import { NextRequest, NextResponse } from 'next/server'
import { getBandsForEvent } from '@/lib/db'

// GET bands for a specific event
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      )
    }

    const bands = await getBandsForEvent(eventId)

    return NextResponse.json(bands)
  } catch (error) {
    console.error('Error fetching bands for event:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bands' },
      { status: 500 }
    )
  }
}
