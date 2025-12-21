/**
 * Social Accounts API
 *
 * GET /api/admin/social/accounts - List all connected accounts
 *
 * Admin-only endpoint.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getSocialAccounts, getAvailablePlatforms } from '@/lib/social/db'

export async function GET() {
  // Check admin auth
  const session = await auth()
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const accounts = await getSocialAccounts()
    const availablePlatforms = await getAvailablePlatforms()

    return NextResponse.json({
      accounts,
      availablePlatforms,
    })
  } catch (error) {
    console.error('Error fetching social accounts:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to fetch accounts',
      },
      { status: 500 }
    )
  }
}
