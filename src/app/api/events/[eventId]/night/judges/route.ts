import { NextResponse } from 'next/server'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'
import { getEventById } from '@/lib/db'
import { deleteJudgeSheet } from '@/lib/db/night'
import {
  canEditJudgeScores,
  isEventStatus,
  PHASES,
} from '@/lib/event-lifecycle'
import { getNightState } from '@/lib/night'

interface RouteContext {
  params: Promise<{ eventId: string }>
}

/**
 * DELETE /api/events/[eventId]/night/judges
 * Admin: remove one judge's sheet so it can be entered again (a mistyped
 * score, or a sheet entered under the wrong name). Body: `{ name }`.
 *
 * Allowed until results are locked.
 */
const deleteHandler: ProtectedApiHandler = async (request, context) => {
  try {
    const { eventId } = await (context as RouteContext).params
    const body = await request.json().catch(() => null)
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json(
        { error: 'Judge name is required' },
        { status: 400 }
      )
    }

    const event = await getEventById(eventId)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    if (!isEventStatus(event.status) || !canEditJudgeScores(event.status)) {
      return NextResponse.json(
        {
          error: `Judge scores cannot be changed while the event is "${isEventStatus(event.status) ? PHASES[event.status].label : event.status}". Unlock the results first.`,
          state: await getNightState(eventId),
        },
        { status: 409 }
      )
    }

    const deleted = await deleteJudgeSheet(eventId, name)
    if (deleted === 0) {
      return NextResponse.json(
        {
          error: `No scores found for judge "${name}".`,
          state: await getNightState(eventId),
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      deleted,
      state: await getNightState(eventId),
    })
  } catch (error) {
    console.error('Error deleting judge sheet:', error)
    return NextResponse.json(
      { error: 'Failed to delete the judge scores' },
      { status: 500 }
    )
  }
}

export const DELETE = withAdminProtection(deleteHandler)
