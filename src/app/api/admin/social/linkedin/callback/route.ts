/**
 * LinkedIn OAuth Callback - Handle OAuth response
 *
 * GET /api/admin/social/linkedin/callback
 *
 * Exchanges authorization code for tokens and stores them.
 * Redirects back to admin social settings page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { cookies } from 'next/headers'
import {
  exchangeLinkedInCode,
  getLinkedInOrganizations,
  getBaseUrl,
} from '@/lib/social/linkedin'
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
      console.error('LinkedIn OAuth error:', error, errorDescription)
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
    const storedState = cookieStore.get('linkedin_oauth_state')?.value

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(`${redirectUrl}?error=invalid_state`)
    }

    // Clear state cookie
    cookieStore.delete('linkedin_oauth_state')

    // Exchange code for tokens
    const tokenResponse = await exchangeLinkedInCode(code)

    // Get organizations the user can admin
    const organizations = await getLinkedInOrganizations(
      tokenResponse.access_token
    )

    if (organizations.length === 0) {
      return NextResponse.redirect(
        `${redirectUrl}?error=no_organizations&message=${encodeURIComponent(
          'No LinkedIn organizations found. You need to be an admin of a LinkedIn Company Page to post.'
        )}`
      )
    }

    // For now, use the first organization
    // TODO: Let user choose if they have multiple
    const org = organizations[0]
    const organizationUrn = `urn:li:organization:${org.id}`

    // Calculate token expiry
    const accessTokenExpiresAt = new Date(
      Date.now() + tokenResponse.expires_in * 1000
    )
    const refreshTokenExpiresAt = tokenResponse.refresh_token_expires_in
      ? new Date(Date.now() + tokenResponse.refresh_token_expires_in * 1000)
      : undefined

    // Store account with encrypted tokens
    await connectSocialAccount({
      provider: 'linkedin',
      provider_account_id: org.id,
      provider_account_name: org.localizedName,
      organization_urn: organizationUrn,
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      access_token_expires_at: accessTokenExpiresAt,
      refresh_token_expires_at: refreshTokenExpiresAt,
      scopes: tokenResponse.scope.split(' '),
      connected_by: session.user.email || session.user.id,
    })

    // Redirect back to social settings with success
    return NextResponse.redirect(`${redirectUrl}?connected=linkedin`)
  } catch (error) {
    console.error('LinkedIn callback error:', error)
    return NextResponse.redirect(
      `${redirectUrl}?error=${encodeURIComponent(
        error instanceof Error ? error.message : 'Connection failed'
      )}`
    )
  }
}
