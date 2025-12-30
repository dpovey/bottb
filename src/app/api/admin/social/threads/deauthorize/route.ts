/**
 * Threads Deauthorize Webhook
 *
 * POST /api/admin/social/threads/deauthorize
 *
 * Called by Meta when a user deauthorizes the app from Threads.
 * We should disconnect their account from our system.
 */

import { NextRequest, NextResponse } from 'next/server'
import { disconnectSocialAccountByProviderId } from '@/lib/social/db'
import { parseSignedRequest } from '@/lib/social/meta-webhooks'

export async function POST(request: NextRequest) {
  try {
    const appSecret = process.env.THREADS_APP_SECRET

    if (!appSecret) {
      console.error('[Threads Deauthorize] Missing THREADS_APP_SECRET')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Get the signed_request from form data
    const formData = await request.formData()
    const signedRequest = formData.get('signed_request')

    if (!signedRequest || typeof signedRequest !== 'string') {
      console.error('[Threads Deauthorize] Missing signed_request')
      return NextResponse.json(
        { error: 'Missing signed_request' },
        { status: 400 }
      )
    }

    // Parse and verify the signed request
    const data = parseSignedRequest(signedRequest, appSecret)

    if (!data || !data.user_id) {
      return NextResponse.json(
        { error: 'Invalid signed_request' },
        { status: 400 }
      )
    }

    console.log(
      `[Threads Deauthorize] User ${data.user_id} deauthorized the app`
    )

    // Disconnect the account from our system
    await disconnectSocialAccountByProviderId('threads', data.user_id)

    console.log(
      `[Threads Deauthorize] Successfully disconnected Threads account ${data.user_id}`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Threads Deauthorize] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
