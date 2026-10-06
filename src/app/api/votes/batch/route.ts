import { isIP } from 'net'
import { NextRequest, NextResponse } from 'next/server'
import { competingBands, isCompetingBand } from '@/lib/competing-bands'
import { getBandsForEvent, getEventById } from '@/lib/db'
import {
  hasJudgeSubmitted,
  insertJudgeSheet,
  type JudgeSheetRow,
} from '@/lib/db/night'
import {
  canEditJudgeScores,
  isEventStatus,
  PHASES,
} from '@/lib/event-lifecycle'
import { getCategoryById, parseScoringVersion } from '@/lib/scoring'
import { withAdminProtection } from '@/lib/api-protection'

const MAX_JUDGE_NAME_LENGTH = 100

interface SubmittedScore {
  event_id?: unknown
  band_id?: unknown
  voter_type?: unknown
  name?: unknown
  song_choice?: unknown
  performance?: unknown
  crowd_vibe?: unknown
  visuals?: unknown
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

/**
 * POST /api/votes/batch — record one judge's sheet. Admin only.
 *
 * Body: `{ votes: [{ event_id, band_id, voter_type: 'judge', name, song_choice,
 * performance, crowd_vibe, visuals? }, ...] }` — one entry per competing band
 * in the event (special guests are left off), all for the same judge.
 *
 * The sheet is validated as a whole (every competing band exactly once, every score a
 * whole number within the scoring version's range) and saved in one
 * statement, so a judge is either fully recorded or not at all. Allowed until
 * results are locked.
 */
async function handleBatchVotes(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const votes: SubmittedScore[] | undefined = body?.votes

    if (!Array.isArray(votes)) {
      return badRequest('Invalid votes data')
    }

    if (votes.length === 0) {
      return badRequest('The sheet has no scores on it')
    }

    const eventId = votes[0].event_id
    const judgeName =
      typeof votes[0].name === 'string' ? votes[0].name.trim() : ''
    if (typeof eventId !== 'string' || !eventId) {
      return badRequest('event_id is required')
    }
    if (!judgeName) {
      return badRequest("The judge's name is required")
    }
    if (judgeName.length > MAX_JUDGE_NAME_LENGTH) {
      return badRequest(
        `The judge's name must be ${MAX_JUDGE_NAME_LENGTH} characters or fewer`
      )
    }
    if (
      votes.some(
        (v) =>
          v.voter_type !== 'judge' ||
          v.event_id !== eventId ||
          (typeof v.name === 'string' ? v.name.trim() : '') !== judgeName
      )
    ) {
      return badRequest(
        'A sheet must contain judge scores from one judge for one event'
      )
    }

    // Validate event status before allowing votes
    const event = await getEventById(eventId)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (!isEventStatus(event.status) || !canEditJudgeScores(event.status)) {
      return NextResponse.json(
        {
          error: `Judge scores cannot be entered while the event is "${isEventStatus(event.status) ? PHASES[event.status].label : event.status}"`,
          eventStatus: event.status,
        },
        { status: 403 }
      )
    }

    // The sheet must cover every competing band in the event exactly once.
    // Special guests (non-competing bands) are not judged.
    const allBands = await getBandsForEvent(eventId)
    const bands = competingBands(allBands)
    const bandNames = new Map(bands.map((b) => [b.id, b.name]))
    const seen = new Set<string>()
    for (const vote of votes) {
      const guest = allBands.find(
        (b) => b.id === vote.band_id && !isCompetingBand(b)
      )
      if (guest) {
        return badRequest(
          `${guest.name} are special guests and are not judged. Leave them off the sheet.`
        )
      }
      if (typeof vote.band_id !== 'string' || !bandNames.has(vote.band_id)) {
        return badRequest('The sheet includes a band that is not in this event')
      }
      if (seen.has(vote.band_id)) {
        return badRequest(
          `${bandNames.get(vote.band_id)} appears more than once on the sheet`
        )
      }
      seen.add(vote.band_id)
    }
    const missing = bands.filter((b) => !seen.has(b.id))
    if (missing.length > 0) {
      return badRequest(
        `The sheet is missing scores for ${missing.map((b) => b.name).join(', ')}`
      )
    }

    // Every score must be a whole number in range for this scoring version.
    const version = parseScoringVersion(
      event.info as { scoring_version?: string } | null
    )
    const criteria = [
      { field: 'song_choice', label: 'Song Choice' },
      { field: 'performance', label: 'Performance' },
      { field: 'crowd_vibe', label: 'Crowd Vibe' },
      { field: 'visuals', label: 'Visuals' },
    ] as const
    const rows: JudgeSheetRow[] = []
    for (const vote of votes) {
      const bandId = vote.band_id as string
      const scores: Record<string, number | null> = {}
      for (const { field, label } of criteria) {
        const max = getCategoryById(version, field)?.maxPoints
        if (max === undefined) {
          // Not a category in this scoring version.
          scores[field] = null
          continue
        }
        const value = vote[field]
        if (
          typeof value !== 'number' ||
          !Number.isInteger(value) ||
          value < 0 ||
          value > max
        ) {
          return badRequest(
            `${label} for ${bandNames.get(bandId)} must be a whole number from 0 to ${max}`
          )
        }
        scores[field] = value
      }
      rows.push({
        band_id: bandId,
        song_choice: scores.song_choice ?? 0,
        performance: scores.performance ?? 0,
        crowd_vibe: scores.crowd_vibe ?? 0,
        visuals: scores.visuals,
      })
    }

    // One sheet per judge. Delete the old one on "Run the night" to re-enter.
    if (await hasJudgeSubmitted(eventId, judgeName)) {
      return NextResponse.json(
        { error: `Already recorded a vote for judge: ${judgeName}` },
        { status: 409 }
      )
    }

    const forwardedFor = request.headers
      .get('x-forwarded-for')
      ?.split(',')[0]
      .trim()
    let inserted: number
    try {
      inserted = await insertJudgeSheet(eventId, judgeName, rows, {
        ip_address: forwardedFor && isIP(forwardedFor) ? forwardedFor : null,
        user_agent: request.headers.get('user-agent'),
      })
    } catch (error) {
      // The same sheet was submitted twice at once; the first one was saved.
      if ((error as { code?: unknown } | null)?.code === '23505') {
        return NextResponse.json(
          { error: `Already recorded a vote for judge: ${judgeName}` },
          { status: 409 }
        )
      }
      throw error
    }
    if (inserted !== rows.length) {
      // The event's status moved on between the check above and the insert.
      return NextResponse.json(
        {
          error:
            'The scores were not saved because the event status changed. Check "Run the night" and try again.',
        },
        { status: 409 }
      )
    }

    return NextResponse.json({
      votes: rows.map((row) => ({
        ...row,
        name: judgeName,
        event_id: eventId,
      })),
    })
  } catch (error) {
    console.error('Error submitting batch votes:', error)
    return NextResponse.json(
      { error: 'Failed to submit votes' },
      { status: 500 }
    )
  }
}

export const POST = withAdminProtection(handleBatchVotes)
