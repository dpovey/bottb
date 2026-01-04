import { NextRequest, NextResponse } from 'next/server'
import { getEventById, getBandsForEvent } from '@/lib/db'
import { sql } from '@/lib/sql'
import {
  withPublicRateLimit,
  withAdminProtection,
  ProtectedApiHandler,
} from '@/lib/api-protection'

async function handleGetEvent(request: NextRequest, _context?: unknown) {
  try {
    // Extract eventId from the URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const eventId = pathParts[pathParts.length - 1]

    const event = await getEventById(eventId)

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error('Error fetching event:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withPublicRateLimit(handleGetEvent)

interface EventUpdateBody {
  name?: string
  date?: string
  location?: string
  timezone?: string
  status?: 'upcoming' | 'voting' | 'finalized'
  description?: string | null
  info?: Record<string, unknown>
}

// PATCH - Update an event (admin only)
const handleUpdateEvent: ProtectedApiHandler = async (
  request: NextRequest,
  _context?: unknown
) => {
  try {
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const eventId = pathParts[pathParts.length - 1]

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      )
    }

    const existing = await getEventById(eventId)
    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const body: EventUpdateBody = await request.json()
    const { name, date, location, timezone, status, description, info } = body

    const { rows } = await sql`
      UPDATE events SET
        name = COALESCE(${name || null}, name),
        date = COALESCE(${date || null}, date),
        location = COALESCE(${location || null}, location),
        timezone = COALESCE(${timezone || null}, timezone),
        status = COALESCE(${status || null}, status),
        description = ${description === undefined ? existing.description : description},
        info = ${info ? JSON.stringify(info) : existing.info}
      WHERE id = ${eventId}
      RETURNING *
    `

    return NextResponse.json({ event: rows[0] })
  } catch (error) {
    console.error('Error updating event:', error)
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    )
  }
}

export const PATCH = withAdminProtection(handleUpdateEvent)

// DELETE - Delete an event (admin only)
const handleDeleteEvent: ProtectedApiHandler = async (
  request: NextRequest,
  _context?: unknown
) => {
  try {
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const eventId = pathParts[pathParts.length - 1]

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      )
    }

    const existing = await getEventById(eventId)
    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Check for associated data
    const bands = await getBandsForEvent(eventId)
    if (bands.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete event "${existing.name}" - it has ${bands.length} band(s). Delete bands first.`,
          bandCount: bands.length,
        },
        { status: 409 }
      )
    }

    // Check for votes
    const { rows: voteRows } = await sql<{ count: string }>`
      SELECT COUNT(*) as count FROM votes WHERE event_id = ${eventId}
    `
    const voteCount = parseInt(voteRows[0]?.count || '0', 10)
    if (voteCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete event "${existing.name}" - it has ${voteCount} vote(s). Clear scores first.`,
          voteCount,
        },
        { status: 409 }
      )
    }

    // Check for photos
    const { rows: photoRows } = await sql<{ count: string }>`
      SELECT COUNT(*) as count FROM photos WHERE event_id = ${eventId}
    `
    const photoCount = parseInt(photoRows[0]?.count || '0', 10)
    if (photoCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete event "${existing.name}" - it has ${photoCount} photo(s). Remove photos first.`,
          photoCount,
        },
        { status: 409 }
      )
    }

    // Delete event
    await sql`DELETE FROM events WHERE id = ${eventId}`

    return NextResponse.json({
      success: true,
      message: `Event "${existing.name}" deleted successfully`,
    })
  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    )
  }
}

export const DELETE = withAdminProtection(handleDeleteEvent)
