/**
 * Social Accounts API
 *
 * GET /api/admin/social/accounts - List all connected accounts
 *
 * Admin-only endpoint.
 */

import { NextResponse } from 'next/server'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'
import { getSocialAccounts, getAvailablePlatforms } from '@/lib/social/db'

const handleGetAccounts: ProtectedApiHandler = async () => {
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

export const GET = withAdminProtection(handleGetAccounts)
