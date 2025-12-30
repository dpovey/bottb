/**
 * Threads Data Deletion Webhook
 *
 * POST /api/admin/social/threads/delete
 *
 * Called by Meta when a user requests deletion of their data (GDPR compliance).
 * We should delete all data associated with their Threads account.
 *
 * Must return a confirmation URL where the user can check deletion status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { disconnectSocialAccountByProviderId } from '@/lib/social/db'
import { getBaseUrl } from '@/lib/social/linkedin'
import { parseSignedRequest } from '@/lib/social/meta-webhooks'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const appSecret = process.env.THREADS_APP_SECRET

    if (!appSecret) {
      console.error('[Threads Delete] Missing THREADS_APP_SECRET')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Get the signed_request from form data
    const formData = await request.formData()
    const signedRequest = formData.get('signed_request')

    if (!signedRequest || typeof signedRequest !== 'string') {
      console.error('[Threads Delete] Missing signed_request')
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
      `[Threads Delete] Data deletion request for user ${data.user_id}`
    )

    // Generate a confirmation code for tracking
    const confirmationCode = crypto.randomBytes(16).toString('hex')

    // Delete all data associated with this Threads account
    await disconnectSocialAccountByProviderId('threads', data.user_id)

    console.log(
      `[Threads Delete] Successfully deleted data for Threads account ${data.user_id}`
    )

    // Return the required response format for Meta
    // This includes a URL where the user can check the status of their deletion request
    const baseUrl = getBaseUrl()

    return NextResponse.json({
      url: `${baseUrl}/data-deletion?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    })
  } catch (error) {
    console.error('[Threads Delete] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
