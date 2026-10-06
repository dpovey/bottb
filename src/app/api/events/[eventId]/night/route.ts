import { NextResponse } from 'next/server'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'
import { getNightState } from '@/lib/night'

interface RouteContext {
  params: Promise<{ eventId: string }>
}

/**
 * GET /api/events/[eventId]/night
 * Admin: everything the "Run the night" page shows — status, vote counts,
 * held votes, judge sheets, standings and the transitions on offer.
 */
const getHandler: ProtectedApiHandler = async (_request, context) => {
  try {
    const { eventId } = await (context as RouteContext).params
    const state = await getNightState(eventId)
    if (!state) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    return NextResponse.json(state, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Error loading night state:', error)
    return NextResponse.json(
      { error: 'Failed to load the event state' },
      { status: 500 }
    )
  }
}

export const GET = withAdminProtection(getHandler)
