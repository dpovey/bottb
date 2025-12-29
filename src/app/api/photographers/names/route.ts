import { NextResponse } from 'next/server'
import { getDistinctPhotographers } from '@/lib/db'

// GET distinct photographer names for autocomplete
export async function GET() {
  try {
    const photographers = await getDistinctPhotographers()

    return NextResponse.json({ photographers })
  } catch (error) {
    console.error('Error fetching photographer names:', error)
    return NextResponse.json(
      { error: 'Failed to fetch photographers' },
      { status: 500 }
    )
  }
}
