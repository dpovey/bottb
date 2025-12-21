import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { withAdminProtection } from '@/lib/api-protection'

async function handleClearScores(request: NextRequest, _context?: unknown) {
  try {
    // Extract eventId from the URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const eventId = pathParts[pathParts.length - 2] // clear-scores is the last part, eventId is before it

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      )
    }

    // First, verify the event exists
    const { rows: eventRows } = await sql`
      SELECT id, name, location, date 
      FROM events 
      WHERE id = ${eventId}
    `

    if (eventRows.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const event = eventRows[0]

    // Delete all votes for this event (includes both judge and crowd votes)
    const { rowCount: votesDeleted } = await sql`
      DELETE FROM votes WHERE event_id = ${eventId}
    `

    // Clear crowd noise measurements for this event (includes energy_level, peak_volume, and crowd_score)
    const { rowCount: noiseDeleted } = await sql`
      DELETE FROM crowd_noise_measurements WHERE event_id = ${eventId}
    `

    return NextResponse.json({
      success: true,
      message: `Cleared ${votesDeleted} votes and ${noiseDeleted} crowd noise measurements for event "${event.name}"`,
      eventId,
      votesDeleted,
      noiseDeleted,
    })
  } catch (error) {
    console.error('Error clearing scores:', error)
    return NextResponse.json(
      { error: 'Failed to clear scores' },
      { status: 500 }
    )
  }
}

export const DELETE = withAdminProtection(handleClearScores)
