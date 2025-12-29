import { NextResponse } from 'next/server'
import { sql } from '@/lib/sql'
import { Band } from '@/lib/db'
import { withPublicRateLimit } from '@/lib/api-protection'

export const GET = withPublicRateLimit(async function GET() {
  try {
    const { rows } = await sql<Band>`
      SELECT * FROM bands ORDER BY event_id, "order"
    `
    return NextResponse.json({ bands: rows })
  } catch (error) {
    console.error('Error fetching bands:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bands' },
      { status: 500 }
    )
  }
})
