/**
 * Threads OAuth Connect - Initiate OAuth flow
 *
 * GET /api/admin/social/threads/connect
 *
 * Redirects to Threads OAuth dialog to authorize the app.
 * Threads uses a separate OAuth flow from Facebook/Instagram.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { cookies } from 'next/headers'
import { getThreadsAuthUrl } from '@/lib/social/meta'

export async function GET() {
  // Check admin auth
  const session = await auth()
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Generate state token for CSRF protection
    const state = crypto.randomUUID()

    // Store state in cookie for verification
    const cookieStore = await cookies()
    cookieStore.set('threads_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    })

    // Redirect to Threads OAuth
    const authUrl = getThreadsAuthUrl(state)
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Threads OAuth error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'OAuth initialization failed',
      },
      { status: 500 }
    )
  }
}
