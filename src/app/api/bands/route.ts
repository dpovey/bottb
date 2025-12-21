import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { Band } from '@/lib/db'

export async function GET() {
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
}
