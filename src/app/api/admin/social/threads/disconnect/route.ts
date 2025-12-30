/**
 * Threads Disconnect - Remove connected Threads account
 *
 * DELETE /api/admin/social/threads/disconnect
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { disconnectSocialAccount } from '@/lib/social/db'

export async function DELETE() {
  // Check admin auth
  const session = await auth()
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await disconnectSocialAccount('threads')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Threads disconnect error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Disconnect failed' },
      { status: 500 }
    )
  }
}
