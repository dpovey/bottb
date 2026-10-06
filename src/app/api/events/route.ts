import { NextRequest, NextResponse } from 'next/server'
import { getEvents, getEventById } from '@/lib/db'
import { sql } from '@/lib/sql'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'
import type { EventStatus } from '@/lib/event-lifecycle'

async function handleGetEvents(request: NextRequest) {
  try {
    // All events, newest first (an event that has started but is still
    // voting is neither "upcoming" nor "past", so don't build from those).
    // The rehearsal ("test") event is only listed when asked for, so it stays
    // out of pickers such as the photo metadata editor.
    const includeTest =
      new URL(request.url).searchParams.get('includeTest') === '1'
    const allEvents = await getEvents({ includeTest })

    return NextResponse.json(allEvents)
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}

// Admin-only endpoint to get all events
export const GET = withAdminProtection(handleGetEvents)

// Helper to generate ID from name
function nameToId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

interface EventCreateBody {
  id?: string
  name: string
  date: string
  location: string
  timezone?: string
  status?: EventStatus
  info?: Record<string, unknown>
}

// POST - Create a new event (admin only)
const handleCreateEvent: ProtectedApiHandler = async (request: NextRequest) => {
  try {
    const body: EventCreateBody = await request.json()
    const { name, date, location, timezone, status, info } = body

    if (!name || !date || !location) {
      return NextResponse.json(
        { error: 'Name, date, and location are required' },
        { status: 400 }
      )
    }

    // Generate ID from name if not provided
    const id = body.id || nameToId(name)

    // Check if ID already exists
    const existing = await getEventById(id)
    if (existing) {
      return NextResponse.json(
        { error: `Event with id "${id}" already exists` },
        { status: 409 }
      )
    }

    const { rows } = await sql`
      INSERT INTO events (id, name, date, location, timezone, status, info)
      VALUES (
        ${id},
        ${name},
        ${date},
        ${location},
        ${timezone || 'Australia/Brisbane'},
        ${status || 'upcoming'},
        ${JSON.stringify(info || {})}
      )
      RETURNING *
    `

    return NextResponse.json({ event: rows[0] }, { status: 201 })
  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}

export const POST = withAdminProtection(handleCreateEvent)
