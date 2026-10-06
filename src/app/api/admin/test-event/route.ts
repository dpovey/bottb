import { NextResponse } from 'next/server'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'
import { ensureTestEvent } from '@/lib/db/night'
import { getDefaultScoringVersion } from '@/lib/scoring'

/**
 * POST /api/admin/test-event
 * Admin: create the rehearsal event (five made-up bands, current scoring
 * version) if it does not exist yet, and return it. The event is flagged
 * `is_test`, which keeps it out of every public listing.
 */
const postHandler: ProtectedApiHandler = async () => {
  try {
    const event = await ensureTestEvent(getDefaultScoringVersion())
    return NextResponse.json({ event })
  } catch (error) {
    console.error('Error creating test event:', error)
    return NextResponse.json(
      { error: 'Failed to create the test event' },
      { status: 500 }
    )
  }
}

export const POST = withAdminProtection(postHandler)
