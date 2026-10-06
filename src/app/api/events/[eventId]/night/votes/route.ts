import { NextResponse } from 'next/server'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'
import { getEventById } from '@/lib/db'
import { isUuid, setCrowdVoteStatus } from '@/lib/db/night'
import { canReviewVotes, isEventStatus, PHASES } from '@/lib/event-lifecycle'
import { getNightState } from '@/lib/night'

interface RouteContext {
  params: Promise<{ eventId: string }>
}

const DECISIONS = ['approved', 'rejected', 'pending'] as const
type Decision = (typeof DECISIONS)[number]

/** Enough for any crowd; stops a malformed request updating without bound. */
const MAX_VOTES_PER_REQUEST = 2000

/**
 * PATCH /api/events/[eventId]/night/votes
 * Admin: approve or reject held crowd votes, or send a decided vote back to
 * `pending`. Body: `{ status, voteIds }`. Only the listed votes are touched,
 * so a bulk action can never reach a vote the admin was not shown.
 *
 * Allowed while the event is `voting` or `closed`.
 */
const patchHandler: ProtectedApiHandler = async (request, context, session) => {
  try {
    const { eventId } = await (context as RouteContext).params
    const body = await request.json().catch(() => null)

    const status = body?.status as Decision
    if (!DECISIONS.includes(status)) {
      return NextResponse.json(
        { error: "status must be 'approved', 'rejected' or 'pending'" },
        { status: 400 }
      )
    }
    const voteIds: unknown = body?.voteIds
    if (
      !Array.isArray(voteIds) ||
      voteIds.length === 0 ||
      voteIds.length > MAX_VOTES_PER_REQUEST ||
      !voteIds.every(isUuid)
    ) {
      return NextResponse.json(
        { error: 'voteIds must be a non-empty list of vote ids' },
        { status: 400 }
      )
    }

    const event = await getEventById(eventId)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    if (!isEventStatus(event.status) || !canReviewVotes(event.status)) {
      return NextResponse.json(
        {
          error: `Votes cannot be changed while the event is "${isEventStatus(event.status) ? PHASES[event.status].label : event.status}".`,
          state: await getNightState(eventId),
        },
        { status: 409 }
      )
    }

    const updated = await setCrowdVoteStatus(
      eventId,
      [...new Set(voteIds as string[])],
      status,
      session?.user?.email ?? session?.user?.name ?? null
    )

    return NextResponse.json({
      updated: updated.length,
      state: await getNightState(eventId),
    })
  } catch (error) {
    console.error('Error reviewing votes:', error)
    return NextResponse.json(
      { error: 'Failed to update the votes' },
      { status: 500 }
    )
  }
}

export const PATCH = withAdminProtection(patchHandler)
