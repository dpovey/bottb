/**
 * Meta OAuth Connect - Initiate OAuth flow
 *
 * GET /api/admin/social/meta/connect
 *
 * Redirects to Facebook OAuth dialog to authorize the app
 * for Facebook Page and Instagram Business Account access.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { cookies } from 'next/headers'
import { getMetaAuthUrl } from '@/lib/social/meta'

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
    cookieStore.set('meta_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    })

    // Redirect to Meta OAuth
    const authUrl = getMetaAuthUrl(state)
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Meta OAuth error:', error)
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
