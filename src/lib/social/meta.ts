/**
 * Meta (Facebook/Instagram/Threads) API client
 *
 * Uses the Facebook Graph API for:
 * - OAuth 2.0 authorization
 * - Facebook Page photo posting
 * - Instagram Business Account carousel/single image posting
 * - Threads posting
 *
 * Required scopes:
 * - pages_show_list - list pages user manages
 * - pages_read_engagement - read page info
 * - pages_manage_posts - post to pages
 * - instagram_basic - basic IG info
 * - instagram_content_publish - publish to IG
 * - threads_basic - basic Threads info
 * - threads_content_publish - publish to Threads
 *
 * Environment variables:
 * - META_APP_ID
 * - META_APP_SECRET
 * - NEXT_PUBLIC_BASE_URL (for OAuth redirect, auto-detected on Vercel)
 */

import { getBaseUrl } from './linkedin'

const GRAPH_API_VERSION = 'v21.0'
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`
const THREADS_API_BASE = `https://graph.threads.net/${GRAPH_API_VERSION}`

// ============================================================================
// Types
// ============================================================================

export interface MetaTokenResponse {
  access_token: string
  token_type: string
  expires_in?: number
}

export interface MetaPage {
  id: string
  name: string
  access_token: string
  instagram_business_account?: {
    id: string
  }
}

export interface MetaPagesResponse {
  data: MetaPage[]
}

export interface MetaUserResponse {
  id: string
  name: string
}

export interface InstagramAccount {
  id: string
  username: string
  name?: string
}

export interface ThreadsAccount {
  id: string
  username: string
  name?: string
  threads_profile_picture_url?: string
  threads_biography?: string
}

export interface MetaMediaResponse {
  id: string
}

export interface MetaPostResponse {
  id: string
  post_id?: string
}

// ============================================================================
// OAuth
// ============================================================================

/**
 * Get the Meta OAuth authorization URL
 */
export function getMetaAuthUrl(state: string): string {
  const appId = process.env.META_APP_ID

  if (!appId) {
    throw new Error('META_APP_ID environment variable is required')
  }

  const baseUrl = getBaseUrl()
  const redirectUri = `${baseUrl}/api/admin/social/meta/callback`

  // Request permissions for Facebook Pages and Instagram
  // Note: Threads uses a separate OAuth flow at /api/admin/social/threads/connect
  const scopes = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'business_management',
    'instagram_basic',
    'instagram_content_publish',
  ].join(',')

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: scopes,
    response_type: 'code',
  })

  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeMetaCode(
  code: string
): Promise<MetaTokenResponse> {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error(
      'Meta OAuth environment variables are required (META_APP_ID, META_APP_SECRET)'
    )
  }

  const baseUrl = getBaseUrl()
  const redirectUri = `${baseUrl}/api/admin/social/meta/callback`

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  })

  const response = await fetch(
    `${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      `Meta token exchange failed: ${error.error?.message || response.statusText}`
    )
  }

  return response.json()
}

/**
 * Exchange short-lived token for long-lived token (60 days)
 */
export async function getLongLivedToken(
  shortLivedToken: string
): Promise<MetaTokenResponse> {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error('Meta app credentials required')
  }

  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  })

  const response = await fetch(
    `${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      `Failed to get long-lived token: ${error.error?.message || response.statusText}`
    )
  }

  return response.json()
}

// ============================================================================
// Threads OAuth (separate from Facebook Login)
// ============================================================================

const THREADS_AUTH_BASE = 'https://threads.net/oauth'

/**
 * Get the Threads OAuth authorization URL
 * Threads uses a separate OAuth endpoint from Facebook
 * Note: Threads has its own app ID separate from the main Meta app
 */
export function getThreadsAuthUrl(state: string): string {
  const appId = process.env.THREADS_APP_ID

  if (!appId) {
    throw new Error('THREADS_APP_ID environment variable is required')
  }

  const baseUrl = getBaseUrl()
  const redirectUri = `${baseUrl}/api/admin/social/threads/callback`

  const scopes = ['threads_basic', 'threads_content_publish'].join(',')

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: scopes,
    response_type: 'code',
  })

  return `${THREADS_AUTH_BASE}/authorize?${params.toString()}`
}

/**
 * Exchange Threads authorization code for access token
 */
export async function exchangeThreadsCode(
  code: string
): Promise<MetaTokenResponse> {
  const appId = process.env.THREADS_APP_ID
  const appSecret = process.env.THREADS_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error(
      'Threads OAuth environment variables are required (THREADS_APP_ID, THREADS_APP_SECRET)'
    )
  }

  const baseUrl = getBaseUrl()
  const redirectUri = `${baseUrl}/api/admin/social/threads/callback`

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
    grant_type: 'authorization_code',
  })

  const response = await fetch(
    `${THREADS_AUTH_BASE}/access_token?${params.toString()}`,
    { method: 'POST' }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      `Threads token exchange failed: ${error.error_message || error.error?.message || response.statusText}`
    )
  }

  return response.json()
}

/**
 * Exchange short-lived Threads token for long-lived token (60 days)
 */
export async function getThreadsLongLivedToken(
  shortLivedToken: string
): Promise<MetaTokenResponse> {
  const appSecret = process.env.THREADS_APP_SECRET

  if (!appSecret) {
    throw new Error('THREADS_APP_SECRET environment variable is required')
  }

  const params = new URLSearchParams({
    grant_type: 'th_exchange_token',
    client_secret: appSecret,
    access_token: shortLivedToken,
  })

  const response = await fetch(
    `${THREADS_API_BASE}/access_token?${params.toString()}`
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      `Failed to get Threads long-lived token: ${error.error_message || error.error?.message || response.statusText}`
    )
  }

  return response.json()
}

// ============================================================================
// User & Pages
// ============================================================================

/**
 * Get the authenticated user's info
 */
export async function getMetaUser(
  accessToken: string
): Promise<MetaUserResponse> {
  const response = await fetch(
    `${GRAPH_API_BASE}/me?access_token=${accessToken}`
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      `Failed to get user info: ${error.error?.message || response.statusText}`
    )
  }

  return response.json()
}

/**
 * Get pages the user manages (with their access tokens)
 */
export async function getMetaPages(accessToken: string): Promise<MetaPage[]> {
  // First, let's check what permissions the token has
  const debugUrl = `${GRAPH_API_BASE}/me/permissions?access_token=${accessToken}`
  const debugResponse = await fetch(debugUrl)
  const debugData = await debugResponse.json()
  console.log('[Meta] Token permissions:', JSON.stringify(debugData, null, 2))

  const params = new URLSearchParams({
    access_token: accessToken,
    fields: 'id,name,access_token,instagram_business_account',
  })

  const url = `${GRAPH_API_BASE}/me/accounts?${params.toString()}`
  console.log('[Meta] Fetching pages from:', url.replace(accessToken, '***'))

  const response = await fetch(url)
  const data = await response.json()

  if (!response.ok) {
    console.error('[Meta] Failed to get pages:', data)
    throw new Error(
      `Failed to get pages: ${data.error?.message || response.statusText}`
    )
  }

  console.log('[Meta] Pages response:', JSON.stringify(data, null, 2))
  return data.data || []
}

/**
 * Get Instagram Business Account details
 */
export async function getInstagramAccount(
  igAccountId: string,
  accessToken: string
): Promise<InstagramAccount> {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: 'id,username,name',
  })

  const response = await fetch(
    `${GRAPH_API_BASE}/${igAccountId}?${params.toString()}`
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      `Failed to get Instagram account: ${error.error?.message || response.statusText}`
    )
  }

  return response.json()
}

// ============================================================================
// Facebook Page Posting
// ============================================================================

/**
 * Post a photo to a Facebook Page
 */
export async function postToFacebookPage(
  pageId: string,
  pageAccessToken: string,
  imageUrl: string,
  caption: string
): Promise<MetaPostResponse> {
  const params = new URLSearchParams({
    access_token: pageAccessToken,
    url: imageUrl,
    caption,
  })

  const response = await fetch(
    `${GRAPH_API_BASE}/${pageId}/photos?${params.toString()}`,
    { method: 'POST' }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      `Failed to post to Facebook: ${error.error?.message || response.statusText}`
    )
  }

  return response.json()
}

/**
 * Post multiple photos to a Facebook Page as an album/carousel
 */
export async function postMultipleToFacebookPage(
  pageId: string,
  pageAccessToken: string,
  imageUrls: string[],
  caption: string
): Promise<MetaPostResponse> {
  // First, upload each photo as unpublished
  const photoIds: string[] = []

  for (const imageUrl of imageUrls) {
    const params = new URLSearchParams({
      access_token: pageAccessToken,
      url: imageUrl,
      published: 'false',
    })

    const response = await fetch(
      `${GRAPH_API_BASE}/${pageId}/photos?${params.toString()}`,
      { method: 'POST' }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(
        `Failed to upload photo: ${error.error?.message || response.statusText}`
      )
    }

    const result: MetaMediaResponse = await response.json()
    photoIds.push(result.id)
  }

  // Now create a post with all the photos attached
  const formData = new URLSearchParams({
    access_token: pageAccessToken,
    message: caption,
  })

  // Add each photo as attached_media
  photoIds.forEach((id, index) => {
    formData.append(
      `attached_media[${index}]`,
      JSON.stringify({ media_fbid: id })
    )
  })

  const response = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      `Failed to create multi-photo post: ${error.error?.message || response.statusText}`
    )
  }

  return response.json()
}

// ============================================================================
// Instagram Posting
// ============================================================================

/**
 * Create an Instagram media container (for single image)
 *
 * Note: Instagram requires images to be publicly accessible URLs
 * and meet specific requirements:
 * - JPEG format
 * - Aspect ratio between 4:5 and 1.91:1
 * - Max 8MB
 */
export async function createInstagramMediaContainer(
  igAccountId: string,
  accessToken: string,
  imageUrl: string,
  caption: string
): Promise<string> {
  const params = new URLSearchParams({
    access_token: accessToken,
    image_url: imageUrl,
    caption,
  })

  const response = await fetch(
    `${GRAPH_API_BASE}/${igAccountId}/media?${params.toString()}`,
    { method: 'POST' }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      `Failed to create IG media container: ${error.error?.message || response.statusText}`
    )
  }

  const result: MetaMediaResponse = await response.json()
  return result.id
}

/**
 * Create an Instagram carousel item container
 */
export async function createInstagramCarouselItem(
  igAccountId: string,
  accessToken: string,
  imageUrl: string
): Promise<string> {
  const params = new URLSearchParams({
    access_token: accessToken,
    image_url: imageUrl,
    is_carousel_item: 'true',
  })

  const response = await fetch(
    `${GRAPH_API_BASE}/${igAccountId}/media?${params.toString()}`,
    { method: 'POST' }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      `Failed to create IG carousel item: ${error.error?.message || response.statusText}`
    )
  }

  const result: MetaMediaResponse = await response.json()
  return result.id
}

/**
 * Create an Instagram carousel container
 */
export async function createInstagramCarouselContainer(
  igAccountId: string,
  accessToken: string,
  childrenIds: string[],
  caption: string
): Promise<string> {
  const params = new URLSearchParams({
    access_token: accessToken,
    media_type: 'CAROUSEL',
    caption,
  })

  // Add children IDs
  params.append('children', childrenIds.join(','))

  const response = await fetch(
    `${GRAPH_API_BASE}/${igAccountId}/media?${params.toString()}`,
    { method: 'POST' }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      `Failed to create IG carousel container: ${error.error?.message || response.statusText}`
    )
  }

  const result: MetaMediaResponse = await response.json()
  return result.id
}

/**
 * Publish an Instagram media container
 */
export async function publishInstagramMedia(
  igAccountId: string,
  accessToken: string,
  containerId: string
): Promise<MetaPostResponse> {
  const params = new URLSearchParams({
    access_token: accessToken,
    creation_id: containerId,
  })

  const response = await fetch(
    `${GRAPH_API_BASE}/${igAccountId}/media_publish?${params.toString()}`,
    { method: 'POST' }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      `Failed to publish IG media: ${error.error?.message || response.statusText}`
    )
  }

  return response.json()
}

/**
 * Post a single image to Instagram
 */
export async function postToInstagram(
  igAccountId: string,
  accessToken: string,
  imageUrl: string,
  caption: string
): Promise<MetaPostResponse> {
  // Create container
  const containerId = await createInstagramMediaContainer(
    igAccountId,
    accessToken,
    imageUrl,
    caption
  )

  // Publish
  return publishInstagramMedia(igAccountId, accessToken, containerId)
}

/**
 * Post multiple images to Instagram as a carousel
 */
export async function postCarouselToInstagram(
  igAccountId: string,
  accessToken: string,
  imageUrls: string[],
  caption: string
): Promise<MetaPostResponse> {
  if (imageUrls.length < 2) {
    throw new Error('Carousel requires at least 2 images')
  }

  if (imageUrls.length > 10) {
    throw new Error('Carousel supports maximum 10 images')
  }

  // Create carousel item containers for each image
  const childrenIds: string[] = []
  for (const imageUrl of imageUrls) {
    const itemId = await createInstagramCarouselItem(
      igAccountId,
      accessToken,
      imageUrl
    )
    childrenIds.push(itemId)
  }

  // Create carousel container
  const carouselId = await createInstagramCarouselContainer(
    igAccountId,
    accessToken,
    childrenIds,
    caption
  )

  // Publish
  return publishInstagramMedia(igAccountId, accessToken, carouselId)
}

// ============================================================================
// Threads Posting
// ============================================================================

/**
 * Get Threads user profile
 * Note: Threads uses the user's ID from Meta OAuth, not Instagram business account ID
 */
export async function getThreadsAccount(
  accessToken: string
): Promise<ThreadsAccount | null> {
  try {
    const params = new URLSearchParams({
      access_token: accessToken,
      fields: 'id,username,name,threads_profile_picture_url,threads_biography',
    })

    const response = await fetch(`${THREADS_API_BASE}/me?${params.toString()}`)

    if (!response.ok) {
      const error = await response.json()
      console.error('[Threads] Failed to get account:', error)
      return null
    }

    return response.json()
  } catch (error) {
    console.error('[Threads] Error fetching account:', error)
    return null
  }
}

/**
 * Create a Threads media container for a single image post
 *
 * Note: Threads requires images to be publicly accessible URLs
 */
export async function createThreadsMediaContainer(
  threadsUserId: string,
  accessToken: string,
  imageUrl: string,
  caption: string
): Promise<string> {
  const params = new URLSearchParams({
    access_token: accessToken,
    media_type: 'IMAGE',
    image_url: imageUrl,
    text: caption,
  })

  const response = await fetch(
    `${THREADS_API_BASE}/${threadsUserId}/threads?${params.toString()}`,
    { method: 'POST' }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      `Failed to create Threads media container: ${error.error?.message || response.statusText}`
    )
  }

  const result: MetaMediaResponse = await response.json()
  return result.id
}

/**
 * Create a Threads carousel item container
 */
export async function createThreadsCarouselItem(
  threadsUserId: string,
  accessToken: string,
  imageUrl: string
): Promise<string> {
  const params = new URLSearchParams({
    access_token: accessToken,
    media_type: 'IMAGE',
    image_url: imageUrl,
    is_carousel_item: 'true',
  })

  const response = await fetch(
    `${THREADS_API_BASE}/${threadsUserId}/threads?${params.toString()}`,
    { method: 'POST' }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      `Failed to create Threads carousel item: ${error.error?.message || response.statusText}`
    )
  }

  const result: MetaMediaResponse = await response.json()
  return result.id
}

/**
 * Create a Threads carousel container
 */
export async function createThreadsCarouselContainer(
  threadsUserId: string,
  accessToken: string,
  childrenIds: string[],
  caption: string
): Promise<string> {
  const params = new URLSearchParams({
    access_token: accessToken,
    media_type: 'CAROUSEL',
    text: caption,
  })

  // Add children IDs
  params.append('children', childrenIds.join(','))

  const response = await fetch(
    `${THREADS_API_BASE}/${threadsUserId}/threads?${params.toString()}`,
    { method: 'POST' }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      `Failed to create Threads carousel container: ${error.error?.message || response.statusText}`
    )
  }

  const result: MetaMediaResponse = await response.json()
  return result.id
}

/**
 * Publish a Threads media container
 */
export async function publishThreadsMedia(
  threadsUserId: string,
  accessToken: string,
  containerId: string
): Promise<MetaPostResponse> {
  const params = new URLSearchParams({
    access_token: accessToken,
    creation_id: containerId,
  })

  const response = await fetch(
    `${THREADS_API_BASE}/${threadsUserId}/threads_publish?${params.toString()}`,
    { method: 'POST' }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      `Failed to publish Threads media: ${error.error?.message || response.statusText}`
    )
  }

  return response.json()
}

/**
 * Post a single image to Threads
 */
export async function postToThreads(
  threadsUserId: string,
  accessToken: string,
  imageUrl: string,
  caption: string
): Promise<MetaPostResponse> {
  // Create container
  const containerId = await createThreadsMediaContainer(
    threadsUserId,
    accessToken,
    imageUrl,
    caption
  )

  // Publish
  return publishThreadsMedia(threadsUserId, accessToken, containerId)
}

/**
 * Post multiple images to Threads as a carousel
 */
export async function postCarouselToThreads(
  threadsUserId: string,
  accessToken: string,
  imageUrls: string[],
  caption: string
): Promise<MetaPostResponse> {
  if (imageUrls.length < 2) {
    throw new Error('Carousel requires at least 2 images')
  }

  if (imageUrls.length > 10) {
    throw new Error('Carousel supports maximum 10 images')
  }

  // Create carousel item containers for each image
  const childrenIds: string[] = []
  for (const imageUrl of imageUrls) {
    const itemId = await createThreadsCarouselItem(
      threadsUserId,
      accessToken,
      imageUrl
    )
    childrenIds.push(itemId)
  }

  // Create carousel container
  const carouselId = await createThreadsCarouselContainer(
    threadsUserId,
    accessToken,
    childrenIds,
    caption
  )

  // Publish
  return publishThreadsMedia(threadsUserId, accessToken, carouselId)
}
