import { NextRequest, NextResponse } from 'next/server'
import { withAdminProtection } from '@/lib/api-protection'

/**
 * PATCH /api/events/[eventId]/status — retired.
 *
 * This used to set an event's status directly, with no checks. Statuses now
 * only change through the lifecycle steps on the "Run the night" page
 * (`POST /api/events/[eventId]/night/transition`), which guard each step and
 * freeze the results before they can go public. The route is kept so that an
 * admin page left open from before answers with an explanation rather than
 * changing anything.
 */
async function handleUpdateEventStatus(
  _request: NextRequest,
  _context?: unknown
) {
  return NextResponse.json(
    {
      error:
        'Event status is now changed from the "Run the night" page. Reload this page to get it.',
    },
    { status: 410 }
  )
}

export const PATCH = withAdminProtection(handleUpdateEventStatus)
