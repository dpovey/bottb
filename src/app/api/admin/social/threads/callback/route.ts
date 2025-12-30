/**
 * Threads OAuth Callback - Handle OAuth response
 *
 * GET /api/admin/social/threads/callback
 *
 * Exchanges authorization code for tokens and stores them.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { cookies } from 'next/headers'
import {
  exchangeThreadsCode,
  getThreadsLongLivedToken,
  getThreadsAccount,
} from '@/lib/social/meta'
import { getBaseUrl } from '@/lib/social/linkedin'
import { connectSocialAccount } from '@/lib/social/db'

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl()
  const redirectUrl = `${baseUrl}/admin/social`

  // Check admin auth
  const session = await auth()
  if (!session?.user?.isAdmin) {
    return NextResponse.redirect(`${redirectUrl}?error=unauthorized`)
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Check for OAuth error
    if (error) {
      console.error('Threads OAuth error:', error, errorDescription)
      return NextResponse.redirect(
        `${redirectUrl}?error=${encodeURIComponent(errorDescription || error)}`
      )
    }

    // Validate required params
    if (!code || !state) {
      return NextResponse.redirect(`${redirectUrl}?error=missing_params`)
    }

    // Verify state token
    const cookieStore = await cookies()
    const storedState = cookieStore.get('threads_oauth_state')?.value

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(`${redirectUrl}?error=invalid_state`)
    }

    // Clear state cookie
    cookieStore.delete('threads_oauth_state')

    // Exchange code for short-lived token
    console.log('[Threads Callback] Exchanging code for token...')
    const shortLivedToken = await exchangeThreadsCode(code)
    console.log('[Threads Callback] Got short-lived token')

    // Exchange for long-lived token (60 days)
    console.log('[Threads Callback] Exchanging for long-lived token...')
    const longLivedToken = await getThreadsLongLivedToken(
      shortLivedToken.access_token
    )
    console.log('[Threads Callback] Got long-lived token')

    // Get Threads account info
    console.log('[Threads Callback] Fetching Threads account...')
    const threadsAccount = await getThreadsAccount(longLivedToken.access_token)

    if (!threadsAccount) {
      return NextResponse.redirect(
        `${redirectUrl}?error=no_account&message=${encodeURIComponent(
          'Could not retrieve Threads account information.'
        )}`
      )
    }

    console.log(
      '[Threads Callback] Found Threads account:',
      threadsAccount.username
    )

    // Calculate token expiry (long-lived tokens last ~60 days)
    const accessTokenExpiresAt = longLivedToken.expires_in
      ? new Date(Date.now() + longLivedToken.expires_in * 1000)
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // Default 60 days

    // Store Threads account
    await connectSocialAccount({
      provider: 'threads',
      provider_account_id: threadsAccount.id,
      provider_account_name:
        threadsAccount.username ||
        threadsAccount.name ||
        `Threads ${threadsAccount.id}`,
      access_token: longLivedToken.access_token,
      access_token_expires_at: accessTokenExpiresAt,
      scopes: ['threads_basic', 'threads_content_publish'],
      connected_by: session.user.email || session.user.id,
      metadata: {
        threads_biography: threadsAccount.threads_biography,
        threads_profile_picture_url: threadsAccount.threads_profile_picture_url,
      },
    })

    // Redirect back with success message
    return NextResponse.redirect(
      `${redirectUrl}?connected=Threads&message=${encodeURIComponent(
        `Connected Threads account @${threadsAccount.username}`
      )}`
    )
  } catch (error) {
    console.error('Threads callback error:', error)
    return NextResponse.redirect(
      `${redirectUrl}?error=${encodeURIComponent(
        error instanceof Error ? error.message : 'Connection failed'
      )}`
    )
  }
}
