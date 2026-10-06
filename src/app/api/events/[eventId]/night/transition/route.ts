import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'
import { isTransitionId } from '@/lib/event-lifecycle'
import { getPathsToRevalidate, performTransition } from '@/lib/night'

interface RouteContext {
  params: Promise<{ eventId: string }>
}

/**
 * POST /api/events/[eventId]/night/transition
 * Admin: move the event one step through its lifecycle (open voting, close
 * voting, finalise, release, or one of the "undo" steps).
 *
 * Body: `{ transition, acknowledgedWarnings? }`. Answers 409 when the event
 * has already moved on or there is a warning the admin has not accepted, and
 * 422 when something blocks the step. Every answer for an existing event
 * carries the current `state` so the page can redraw.
 */
/** Public pages are cached; a status change must show up straight away. */
function refreshPublicPages(eventId: string) {
  for (const path of getPathsToRevalidate(eventId)) {
    revalidatePath(path)
  }
  revalidateTag('nav-events', 'fiveMinutes')
}

const postHandler: ProtectedApiHandler = async (request, context, session) => {
  let eventId: string | undefined
  try {
    eventId = (await (context as RouteContext).params).eventId
    const body = await request.json().catch(() => null)

    if (!body || !isTransitionId(body.transition)) {
      return NextResponse.json({ error: 'Unknown transition' }, { status: 400 })
    }
    const acknowledgedWarnings = Array.isArray(body.acknowledgedWarnings)
      ? body.acknowledgedWarnings.filter(
          (w: unknown): w is string => typeof w === 'string'
        )
      : []

    const result = await performTransition(
      eventId,
      { transition: body.transition, acknowledgedWarnings },
      session?.user?.email ?? session?.user?.name ?? null
    )

    if (!result.ok) {
      // A failed step may have moved the status and moved it back.
      if (result.code === 'failed') refreshPublicPages(eventId)
      return NextResponse.json(
        {
          error: result.error,
          code: result.code,
          blockers: result.blockers,
          warnings: result.warnings,
          state: result.state,
        },
        { status: result.httpStatus }
      )
    }

    refreshPublicPages(eventId)

    return NextResponse.json({ state: result.state })
  } catch (error) {
    console.error('Error performing transition:', error)
    // The status may have changed before whatever threw; never leave the
    // public pages showing the old one.
    if (eventId) {
      try {
        refreshPublicPages(eventId)
      } catch (revalidateError) {
        console.error('Error refreshing public pages:', revalidateError)
      }
    }
    return NextResponse.json(
      {
        error:
          'Something went wrong. Refresh to see what state the event is in before trying again.',
      },
      { status: 500 }
    )
  }
}

export const POST = withAdminProtection(postHandler)
