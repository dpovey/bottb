import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/sql'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'
import { v4 as uuidv4 } from 'uuid'

interface BandCreateBody {
  event_id: string
  name: string
  description?: string | null
  company_slug?: string | null
  order?: number
  info?: Record<string, unknown>
}

// POST - Create a new band (admin only)
const handleCreateBand: ProtectedApiHandler = async (request: NextRequest) => {
  try {
    const body: BandCreateBody = await request.json()
    const { event_id, name, description, company_slug, info } = body

    if (!event_id || !name) {
      return NextResponse.json(
        { error: 'Event ID and name are required' },
        { status: 400 }
      )
    }

    // Verify event exists
    const { rows: eventRows } = await sql<{ id: string }>`
      SELECT id FROM events WHERE id = ${event_id}
    `
    if (eventRows.length === 0) {
      return NextResponse.json(
        { error: `Event "${event_id}" not found` },
        { status: 404 }
      )
    }

    // Get the next order number for this event
    const { rows: orderRows } = await sql<{ max_order: number | null }>`
      SELECT MAX("order") as max_order FROM bands WHERE event_id = ${event_id}
    `
    const nextOrder = body.order ?? (orderRows[0]?.max_order ?? -1) + 1

    // Generate unique ID
    const id = uuidv4()

    const { rows } = await sql`
      INSERT INTO bands (id, event_id, name, description, company_slug, "order", info)
      VALUES (${id}, ${event_id}, ${name}, ${description || null}, ${company_slug || null}, ${nextOrder}, ${JSON.stringify(info || {})})
      RETURNING *
    `

    return NextResponse.json({ band: rows[0] }, { status: 201 })
  } catch (error) {
    console.error('Error creating band:', error)
    return NextResponse.json(
      { error: 'Failed to create band' },
      { status: 500 }
    )
  }
}

export const POST = withAdminProtection(handleCreateBand)
