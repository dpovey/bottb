/**
 * Meta Disconnect - Remove connected Meta accounts
 *
 * DELETE /api/admin/social/meta/disconnect
 *
 * Removes Facebook Page and Instagram accounts.
 * Threads uses a separate OAuth flow and has its own disconnect endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { sql } from '@/lib/sql'

export async function DELETE(request: NextRequest) {
  // Check admin auth
  const session = await auth()
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { accountId, provider } = await request.json()

    if (accountId) {
      // Delete specific account
      await sql`
        DELETE FROM social_accounts
        WHERE id = ${accountId}
      `
    } else if (provider === 'facebook' || provider === 'instagram') {
      // Delete all accounts for the provider
      await sql`
        DELETE FROM social_accounts
        WHERE provider = ${provider}
      `
    } else {
      // Delete all Meta accounts (Facebook and Instagram only - Threads has its own endpoint)
      await sql`
        DELETE FROM social_accounts
        WHERE provider IN ('facebook', 'instagram')
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Meta disconnect error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Disconnect failed' },
      { status: 500 }
    )
  }
}
