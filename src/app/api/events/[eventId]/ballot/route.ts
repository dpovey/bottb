import { NextRequest, NextResponse } from 'next/server'
import { getBallot } from '@/lib/ballot'

interface RouteContext {
  params: Promise<{ eventId: string }>
}

/**
 * GET /api/events/[eventId]/ballot
 * Public: whether crowd voting is open, and the bands to choose from. The
 * voting page polls this to follow voting opening and closing.
 *
 * Deliberately not rate limited per client — a venue's Wi-Fi puts the whole
 * crowd behind one address — and cached at the CDN instead.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params
    const ballot = await getBallot(eventId)
    if (!ballot) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    return NextResponse.json(ballot, {
      headers: {
        'Cache-Control':
          'public, max-age=0, s-maxage=2, stale-while-revalidate=3',
      },
    })
  } catch (error) {
    console.error('Error loading ballot:', error)
    return NextResponse.json(
      { error: 'Failed to load the ballot' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
