import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'
import { competingBands } from '@/lib/competing-bands'
import { getBandsForEvent, getEventById } from '@/lib/db'
import {
  hasJudgeSubmitted,
  insertJudgeSheet,
  insertSimulatedCrowdVotes,
  resetTestEvent,
} from '@/lib/db/night'
import {
  canEditJudgeScores,
  isCrowdVotingOpen,
  isEventStatus,
} from '@/lib/event-lifecycle'
import { getNightState, getPathsToRevalidate } from '@/lib/night'
import { getCategoryById, parseScoringVersion } from '@/lib/scoring'

interface RouteContext {
  params: Promise<{ eventId: string }>
}

const ACTIONS = ['reset', 'simulate-crowd', 'simulate-judges'] as const
type Action = (typeof ACTIONS)[number]

const SIMULATED_JUDGES = [
  'Rehearsal Judge 1',
  'Rehearsal Judge 2',
  'Rehearsal Judge 3',
]
const MAX_SIMULATED_VOTES = 200

/** A plausible judge score: somewhere in the top half of the range. */
function randomScore(max: number): number {
  const min = Math.ceil(max / 2)
  return min + Math.floor(Math.random() * (max - min + 1))
}

/**
 * POST /api/events/[eventId]/night/test
 * Admin: rehearsal tools. Body: `{ action, count? }` where action is
 * `reset` (wipe votes and go back to "before voting"), `simulate-crowd`
 * (add made-up crowd votes while voting is open) or `simulate-judges` (add
 * three made-up judge sheets).
 *
 * Refused with 403 for anything but a test event — these can never touch a
 * real event's votes.
 */
const postHandler: ProtectedApiHandler = async (request, context) => {
  try {
    const { eventId } = await (context as RouteContext).params
    const body = await request.json().catch(() => null)
    const action = body?.action as Action
    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    const event = await getEventById(eventId)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    if (event.is_test !== true) {
      return NextResponse.json(
        { error: 'Rehearsal tools only work on the test event.' },
        { status: 403 }
      )
    }
    const status = isEventStatus(event.status) ? event.status : 'upcoming'

    let message: string
    if (action === 'reset') {
      await resetTestEvent(eventId)
      for (const path of getPathsToRevalidate(eventId)) {
        revalidatePath(path)
      }
      message = 'Test event reset. All votes and scores are gone.'
    } else if (action === 'simulate-crowd') {
      if (!isCrowdVotingOpen(status)) {
        return NextResponse.json(
          {
            error:
              'Open crowd voting first — simulated votes follow the same rule as real ones.',
            state: await getNightState(eventId),
          },
          { status: 409 }
        )
      }
      const requested = Number(body?.count)
      const count = Number.isInteger(requested)
        ? Math.min(Math.max(requested, 1), MAX_SIMULATED_VOTES)
        : 40
      // Like real votes, simulated ones never go to special guests.
      const bands = competingBands(await getBandsForEvent(eventId))
      const { added, held } = await insertSimulatedCrowdVotes(
        eventId,
        bands.map((b) => b.id),
        count
      )
      message = `Added ${added} simulated crowd votes (${held} held for review).`
    } else {
      if (!canEditJudgeScores(status)) {
        return NextResponse.json(
          {
            error: 'Judge scores cannot be added once results are locked.',
            state: await getNightState(eventId),
          },
          { status: 409 }
        )
      }
      const version = parseScoringVersion(
        event.info as { scoring_version?: string } | null
      )
      const max = (id: string) => getCategoryById(version, id)?.maxPoints
      const visualsMax = max('visuals')
      // Special guests are not judged, so they are not on the sheet.
      const bands = competingBands(await getBandsForEvent(eventId))
      let added = 0
      for (const judge of SIMULATED_JUDGES) {
        if (await hasJudgeSubmitted(eventId, judge)) continue
        const inserted = await insertJudgeSheet(
          eventId,
          judge,
          bands.map((band) => ({
            band_id: band.id,
            song_choice: randomScore(max('song_choice') ?? 20),
            performance: randomScore(max('performance') ?? 20),
            crowd_vibe: randomScore(max('crowd_vibe') ?? 20),
            visuals: visualsMax ? randomScore(visualsMax) : null,
          })),
          { ip_address: null, user_agent: 'BOTTB rehearsal simulator' }
        )
        if (inserted > 0) added++
      }
      message =
        added > 0
          ? `Added ${added} simulated judge ${added === 1 ? 'sheet' : 'sheets'}.`
          : 'The simulated judges have already been entered.'
    }

    return NextResponse.json({
      message,
      state: await getNightState(eventId),
    })
  } catch (error) {
    console.error('Error running rehearsal tool:', error)
    return NextResponse.json(
      { error: 'The rehearsal tool failed' },
      { status: 500 }
    )
  }
}

export const POST = withAdminProtection(postHandler)
