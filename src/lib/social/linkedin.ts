/**
 * LinkedIn API client for organization posts
 *
 * Uses LinkedIn's REST API v2 for:
 * - OAuth 2.0 authorization code flow
 * - Image upload to organization
 * - Multi-image post creation
 *
 * Required scopes: w_organization_social, r_organization_social
 *
 * Environment variables:
 * - LINKEDIN_CLIENT_ID
 * - LINKEDIN_CLIENT_SECRET
 * - NEXT_PUBLIC_BASE_URL (for OAuth redirect, auto-detected on Vercel)
 */

const LINKEDIN_API_BASE = 'https://api.linkedin.com'
const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2'

/**
 * Get the base URL for OAuth redirects.
 * Prioritizes NEXT_PUBLIC_BASE_URL, falls back to Vercel URL.
 */
export function getBaseUrl(): string {
  // Explicit base URL takes priority
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL
  }

  // Vercel production URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  // Vercel preview/branch URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  throw new Error(
    'No base URL configured. Set NEXT_PUBLIC_BASE_URL environment variable.'
  )
}

// ============================================================================
// Types
// ============================================================================

export interface LinkedInTokenResponse {
  access_token: string
  expires_in: number // seconds
  refresh_token?: string
  refresh_token_expires_in?: number
  scope: string
}

export interface LinkedInOrganization {
  id: string
  localizedName: string
  vanityName?: string
  logoUrl?: string
}

export interface LinkedInImageUploadRequest {
  initializeUploadRequest: {
    owner: string // organization URN
  }
}

export interface LinkedInImageUploadResponse {
  value: {
    uploadUrlExpiresAt: number
    uploadUrl: string
    image: string // image URN to use in post
  }
}

export interface LinkedInPostRequest {
  author: string // organization URN
  commentary: string
  visibility: 'PUBLIC' | 'CONNECTIONS'
  distribution: {
    feedDistribution: 'MAIN_FEED'
    targetEntities: never[]
    thirdPartyDistributionChannels: never[]
  }
  content?: {
    media: {
      title?: string
      id: string // image URN
    }[]
  }
  lifecycleState: 'PUBLISHED'
  isReshareDisabledByAuthor: boolean
}

export interface LinkedInPostResponse {
  id: string // post URN
}

// ============================================================================
// OAuth
// ============================================================================

/**
 * Get the LinkedIn OAuth authorization URL
 */
export function getLinkedInAuthUrl(state: string): string {
  const clientId = process.env.LINKEDIN_CLIENT_ID

  if (!clientId) {
    throw new Error('LINKEDIN_CLIENT_ID environment variable is required')
  }

  const baseUrl = getBaseUrl()
  const redirectUri = `${baseUrl}/api/admin/social/linkedin/callback`
  const scopes = ['w_organization_social', 'r_organization_social'].join(' ')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: scopes,
  })

  return `${LINKEDIN_AUTH_URL}/authorization?${params.toString()}`
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeLinkedInCode(
  code: string
): Promise<LinkedInTokenResponse> {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'LinkedIn OAuth environment variables are required (LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET)'
    )
  }

  const baseUrl = getBaseUrl()
  const redirectUri = `${baseUrl}/api/admin/social/linkedin/callback`

  const response = await fetch(`${LINKEDIN_AUTH_URL}/accessToken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LinkedIn token exchange failed: ${error}`)
  }

  return response.json()
}

/**
 * Refresh an expired access token
 */
export async function refreshLinkedInToken(
  refreshToken: string
): Promise<LinkedInTokenResponse> {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'LinkedIn OAuth environment variables are required (LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET)'
    )
  }

  const response = await fetch(`${LINKEDIN_AUTH_URL}/accessToken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LinkedIn token refresh failed: ${error}`)
  }

  return response.json()
}

// ============================================================================
// Organization
// ============================================================================

/**
 * Get organizations the user can admin (for posting)
 */
export async function getLinkedInOrganizations(
  accessToken: string
): Promise<LinkedInOrganization[]> {
  // First, get organization access control (which orgs user can post to)
  const aclResponse = await fetch(
    `${LINKEDIN_API_BASE}/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(id,localizedName,vanityName,logoV2(original~:playableStreams))))`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': '202401',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    }
  )

  if (!aclResponse.ok) {
    const error = await aclResponse.text()
    throw new Error(`Failed to fetch LinkedIn organizations: ${error}`)
  }

  const data = await aclResponse.json()

  // Extract organization details from the response
  const organizations: LinkedInOrganization[] = []

  for (const element of data.elements || []) {
    const org = element['organization~']
    if (org) {
      organizations.push({
        id: org.id,
        localizedName: org.localizedName,
        vanityName: org.vanityName,
        logoUrl:
          org.logoV2?.['original~']?.elements?.[0]?.identifiers?.[0]
            ?.identifier,
      })
    }
  }

  return organizations
}

// ============================================================================
// Image Upload
// ============================================================================

/**
 * Initialize an image upload to LinkedIn
 */
export async function initializeLinkedInImageUpload(
  accessToken: string,
  organizationUrn: string
): Promise<{ uploadUrl: string; imageUrn: string }> {
  const response = await fetch(
    `${LINKEDIN_API_BASE}/rest/images?action=initializeUpload`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202401',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: organizationUrn,
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to initialize LinkedIn image upload: ${error}`)
  }

  const data: LinkedInImageUploadResponse = await response.json()

  return {
    uploadUrl: data.value.uploadUrl,
    imageUrn: data.value.image,
  }
}

/**
 * Upload image binary to LinkedIn's upload URL
 */
export async function uploadLinkedInImage(
  uploadUrl: string,
  imageBuffer: Buffer,
  contentType: string
): Promise<void> {
  // Convert Buffer to Uint8Array for fetch body compatibility
  const uint8Array = new Uint8Array(imageBuffer)

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: uint8Array,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to upload image to LinkedIn: ${error}`)
  }
}

/**
 * Upload an image from a URL to LinkedIn
 * Fetches the image and uploads it to LinkedIn
 */
export async function uploadLinkedInImageFromUrl(
  accessToken: string,
  organizationUrn: string,
  imageUrl: string
): Promise<string> {
  // Fetch the image
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image from ${imageUrl}`)
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
  const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'

  // Initialize upload
  const { uploadUrl, imageUrn } = await initializeLinkedInImageUpload(
    accessToken,
    organizationUrn
  )

  // Upload image binary
  await uploadLinkedInImage(uploadUrl, imageBuffer, contentType)

  return imageUrn
}

// ============================================================================
// Post Creation
// ============================================================================

/**
 * Create a post on LinkedIn as an organization
 */
export async function createLinkedInPost(
  accessToken: string,
  options: {
    organizationUrn: string
    text: string
    imageUrns?: string[]
    title?: string
  }
): Promise<{ postId: string; postUrl: string }> {
  const postBody: LinkedInPostRequest = {
    author: options.organizationUrn,
    commentary: options.text,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  }

  // Add images if provided
  if (options.imageUrns && options.imageUrns.length > 0) {
    postBody.content = {
      media: options.imageUrns.map((urn) => ({
        id: urn,
        title: options.title,
      })),
    }
  }

  const response = await fetch(`${LINKEDIN_API_BASE}/rest/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': '202401',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(postBody),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create LinkedIn post: ${error}`)
  }

  // Get post ID from response header
  const postUrn = response.headers.get('x-restli-id') || ''

  // Extract organization ID and post ID for URL
  // URN format: urn:li:share:1234567890
  const _postIdMatch = postUrn.match(/urn:li:(?:share|ugcPost):(\d+)/)

  // Extract org vanity name from URN for URL (we may need to look this up)
  // For now, use a generic activity URL
  const postUrl = `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}`

  return { postId: postUrn, postUrl }
}

// ============================================================================
// High-level posting function
// ============================================================================

/**
 * Post photos to LinkedIn as an organization
 *
 * @param accessToken - LinkedIn access token
 * @param organizationUrn - Organization URN (e.g., "urn:li:organization:12345")
 * @param options - Post options
 * @returns Post ID and URL
 */
export async function postToLinkedIn(
  accessToken: string,
  organizationUrn: string,
  options: {
    caption: string
    title?: string
    photoUrls: string[]
  }
): Promise<{ postId: string; postUrl: string }> {
  // Upload all images
  const imageUrns: string[] = []
  for (const photoUrl of options.photoUrls) {
    const imageUrn = await uploadLinkedInImageFromUrl(
      accessToken,
      organizationUrn,
      photoUrl
    )
    imageUrns.push(imageUrn)
  }

  // Create post with images
  return createLinkedInPost(accessToken, {
    organizationUrn,
    text: options.caption,
    title: options.title,
    imageUrns,
  })
}
