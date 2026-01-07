/**
 * Social Media Video Upload Module
 *
 * Handles video uploads to:
 * - Facebook Pages (feed videos)
 * - Instagram (Reels for portrait, Feed videos for landscape)
 * - LinkedIn (native video posts)
 *
 * Note: All platforms require the video file to be uploaded, not a URL.
 * This module handles the upload flow for each platform.
 */

const GRAPH_API_VERSION = 'v21.0'
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`
const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2'

// ============================================================================
// Types
// ============================================================================

export interface VideoUploadResult {
  success: boolean
  postId?: string
  postUrl?: string
  error?: string
}

export interface VideoPostOptions {
  caption: string
  title?: string
  /** Video file as a Blob */
  videoFile: Blob
  /** Original filename */
  filename: string
  /** Duration in seconds */
  durationSeconds?: number
  /** Aspect ratio: 'landscape' (16:9), 'portrait' (9:16), or 'square' (1:1) */
  aspectRatio?: 'landscape' | 'portrait' | 'square'
}

// ============================================================================
// Facebook Video Upload
// ============================================================================

/**
 * Upload a video to a Facebook Page
 *
 * Uses the resumable upload API for reliability.
 * Videos can be up to 10GB and 4 hours long.
 *
 * @see https://developers.facebook.com/docs/video-api/guides/publishing
 */
export async function uploadVideoToFacebook(
  pageId: string,
  pageAccessToken: string,
  options: VideoPostOptions
): Promise<VideoUploadResult> {
  const { caption, title, videoFile } = options

  try {
    // Step 1: Initialize the upload session
    const initUrl = `${GRAPH_API_BASE}/${pageId}/videos`
    const initParams = new URLSearchParams({
      access_token: pageAccessToken,
      upload_phase: 'start',
      file_size: String(videoFile.size),
    })

    const initResponse = await fetch(`${initUrl}?${initParams}`, {
      method: 'POST',
    })

    if (!initResponse.ok) {
      const error = await initResponse.json()
      return {
        success: false,
        error: `Facebook init failed: ${error.error?.message || initResponse.statusText}`,
      }
    }

    const initData = await initResponse.json()
    const { upload_session_id, video_id } = initData

    // Step 2: Upload the video file
    const uploadUrl = `${GRAPH_API_BASE}/${pageId}/videos`
    const formData = new FormData()
    formData.append('access_token', pageAccessToken)
    formData.append('upload_phase', 'transfer')
    formData.append('upload_session_id', upload_session_id)
    formData.append('start_offset', '0')
    formData.append('video_file_chunk', videoFile, options.filename)

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    })

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json()
      return {
        success: false,
        error: `Facebook upload failed: ${error.error?.message || uploadResponse.statusText}`,
      }
    }

    // Step 3: Finish the upload
    const finishParams = new URLSearchParams({
      access_token: pageAccessToken,
      upload_phase: 'finish',
      upload_session_id,
      title: title || '',
      description: caption,
    })

    const finishResponse = await fetch(`${uploadUrl}?${finishParams}`, {
      method: 'POST',
    })

    if (!finishResponse.ok) {
      const error = await finishResponse.json()
      return {
        success: false,
        error: `Facebook finish failed: ${error.error?.message || finishResponse.statusText}`,
      }
    }

    // Generate post URL
    const postUrl = `https://www.facebook.com/${pageId}/videos/${video_id}`

    return {
      success: true,
      postId: video_id,
      postUrl,
    }
  } catch (error) {
    return {
      success: false,
      error: `Facebook video upload error: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

// ============================================================================
// Instagram Video Upload (Reels)
// ============================================================================

/**
 * Upload a video to Instagram as a Reel or Feed Post
 *
 * For Reels (portrait/9:16):
 * - Duration: 3 seconds to 15 minutes
 * - File size: up to 1GB
 * - Aspect ratio: 9:16 (but 1.91:1 to 9:16 accepted)
 *
 * For Feed Videos (landscape):
 * - Duration: 3 seconds to 60 minutes
 * - Aspect ratio: 1.91:1 to 9:16
 *
 * Note: Video must be hosted at a publicly accessible URL.
 * We use a temporary upload endpoint.
 *
 * @see https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
 */
export async function uploadVideoToInstagram(
  igAccountId: string,
  accessToken: string,
  videoUrl: string, // Must be a publicly accessible URL
  options: Omit<VideoPostOptions, 'videoFile' | 'filename'>
): Promise<VideoUploadResult> {
  const { caption, aspectRatio = 'landscape' } = options

  try {
    // Determine media type based on aspect ratio
    // Reels work better for portrait, but can accept landscape too
    const isPortrait = aspectRatio === 'portrait'
    const mediaType = isPortrait ? 'REELS' : 'REELS' // Instagram prefers Reels for all video now

    // Step 1: Create media container
    const createUrl = `${GRAPH_API_BASE}/${igAccountId}/media`
    const createParams = new URLSearchParams({
      access_token: accessToken,
      media_type: mediaType,
      video_url: videoUrl,
      caption,
    })

    // Add cover thumbnail for Reels
    if (mediaType === 'REELS') {
      createParams.append('share_to_feed', 'true')
    }

    const createResponse = await fetch(`${createUrl}?${createParams}`, {
      method: 'POST',
    })

    if (!createResponse.ok) {
      const error = await createResponse.json()
      return {
        success: false,
        error: `Instagram create failed: ${error.error?.message || createResponse.statusText}`,
      }
    }

    const createData = await createResponse.json()
    const containerId = createData.id

    // Step 2: Wait for processing and check status
    // Instagram processes videos asynchronously
    let status = 'IN_PROGRESS'
    let attempts = 0
    const maxAttempts = 30 // 5 minutes max

    while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 10000)) // Wait 10 seconds

      const statusUrl = `${GRAPH_API_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
      const statusResponse = await fetch(statusUrl)

      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        status = statusData.status_code
      }

      attempts++
    }

    if (status !== 'FINISHED') {
      return {
        success: false,
        error: `Instagram processing failed. Status: ${status}`,
      }
    }

    // Step 3: Publish the media
    const publishUrl = `${GRAPH_API_BASE}/${igAccountId}/media_publish`
    const publishParams = new URLSearchParams({
      access_token: accessToken,
      creation_id: containerId,
    })

    const publishResponse = await fetch(`${publishUrl}?${publishParams}`, {
      method: 'POST',
    })

    if (!publishResponse.ok) {
      const error = await publishResponse.json()
      return {
        success: false,
        error: `Instagram publish failed: ${error.error?.message || publishResponse.statusText}`,
      }
    }

    const publishData = await publishResponse.json()
    const mediaId = publishData.id

    // Generate post URL (we need the username for this)
    // For now, return a generic URL format
    const postUrl = `https://www.instagram.com/reel/${mediaId}`

    return {
      success: true,
      postId: mediaId,
      postUrl,
    }
  } catch (error) {
    return {
      success: false,
      error: `Instagram video upload error: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

// ============================================================================
// LinkedIn Video Upload
// ============================================================================

/**
 * Upload a video to LinkedIn
 *
 * LinkedIn uses a 3-step process:
 * 1. Initialize upload and get upload URL
 * 2. Upload video file to the URL
 * 3. Create post with the video asset
 *
 * Videos can be up to 200MB (basic) or 5GB (verified organizations).
 *
 * @see https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/videos-api
 */
export async function uploadVideoToLinkedIn(
  accessToken: string,
  organizationUrn: string,
  options: VideoPostOptions
): Promise<VideoUploadResult> {
  const { caption, videoFile, filename } = options
  const fileSize = videoFile.size

  try {
    // Step 1: Initialize the upload
    const initBody = {
      initializeUploadRequest: {
        owner: organizationUrn,
        fileSizeBytes: fileSize,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }

    const initResponse = await fetch(
      `${LINKEDIN_API_BASE}/videos?action=initializeUpload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202401',
        },
        body: JSON.stringify(initBody),
      }
    )

    if (!initResponse.ok) {
      const error = await initResponse.text()
      return {
        success: false,
        error: `LinkedIn init failed: ${error}`,
      }
    }

    const initData = await initResponse.json()
    const { value } = initData
    const { uploadInstructions, video: videoUrn } = value

    // Step 2: Upload to each URL (LinkedIn may split large files)
    for (const instruction of uploadInstructions) {
      const { uploadUrl, firstByte, lastByte } = instruction

      // Get the chunk of data
      const chunk = videoFile.slice(firstByte, lastByte + 1)

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: chunk,
      })

      if (!uploadResponse.ok) {
        return {
          success: false,
          error: `LinkedIn upload chunk failed: ${uploadResponse.statusText}`,
        }
      }
    }

    // Step 3: Finalize the upload
    const finalizeBody = {
      finalizeUploadRequest: {
        video: videoUrn,
        uploadToken: '',
        uploadedPartIds: [],
      },
    }

    const finalizeResponse = await fetch(
      `${LINKEDIN_API_BASE}/videos?action=finalizeUpload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202401',
        },
        body: JSON.stringify(finalizeBody),
      }
    )

    if (!finalizeResponse.ok) {
      const error = await finalizeResponse.text()
      return {
        success: false,
        error: `LinkedIn finalize failed: ${error}`,
      }
    }

    // Step 4: Create the post with the video
    const postBody = {
      author: organizationUrn,
      commentary: caption,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        media: {
          title: filename,
          id: videoUrn,
        },
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }

    const postResponse = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202401',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(postBody),
    })

    if (!postResponse.ok) {
      const error = await postResponse.text()
      return {
        success: false,
        error: `LinkedIn post failed: ${error}`,
      }
    }

    // Get post ID from response header
    const postUrn = postResponse.headers.get('x-restli-id') || ''
    const postUrl = `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}`

    return {
      success: true,
      postId: postUrn,
      postUrl,
    }
  } catch (error) {
    return {
      success: false,
      error: `LinkedIn video upload error: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

// ============================================================================
// Helper to upload video to temporary storage for Instagram
// ============================================================================

/**
 * Upload a video file to Vercel Blob for temporary hosting
 * (Instagram requires a public URL)
 */
export async function uploadVideoToTempStorage(
  _videoFile: Blob,
  _filename: string
): Promise<string | null> {
  // This would use @vercel/blob to upload the file temporarily
  // For now, return null - this needs to be implemented based on your storage solution
  console.warn(
    'Temporary video storage not implemented - Instagram uploads require a public URL'
  )
  return null
}

// ============================================================================
// Combined Video Post Function
// ============================================================================

export interface MultiPlatformVideoResult {
  facebook?: VideoUploadResult
  instagram?: VideoUploadResult
  linkedin?: VideoUploadResult
}

export interface MultiPlatformVideoOptions extends VideoPostOptions {
  platforms: Array<'facebook' | 'instagram' | 'linkedin'>
  // Platform-specific credentials
  facebookPageId?: string
  facebookPageToken?: string
  instagramAccountId?: string
  instagramAccessToken?: string
  linkedinAccessToken?: string
  linkedinOrganizationUrn?: string
  // For Instagram - public URL if video is already hosted
  publicVideoUrl?: string
}

/**
 * Post a video to multiple social platforms
 */
export async function postVideoToMultiplePlatforms(
  options: MultiPlatformVideoOptions
): Promise<MultiPlatformVideoResult> {
  const results: MultiPlatformVideoResult = {}

  const {
    platforms,
    facebookPageId,
    facebookPageToken,
    instagramAccountId,
    instagramAccessToken,
    linkedinAccessToken,
    linkedinOrganizationUrn,
    publicVideoUrl,
    ...videoOptions
  } = options

  // Post to Facebook
  if (platforms.includes('facebook') && facebookPageId && facebookPageToken) {
    results.facebook = await uploadVideoToFacebook(
      facebookPageId,
      facebookPageToken,
      videoOptions
    )
  }

  // Post to Instagram (requires public URL)
  if (
    platforms.includes('instagram') &&
    instagramAccountId &&
    instagramAccessToken
  ) {
    if (publicVideoUrl) {
      results.instagram = await uploadVideoToInstagram(
        instagramAccountId,
        instagramAccessToken,
        publicVideoUrl,
        videoOptions
      )
    } else {
      results.instagram = {
        success: false,
        error:
          'Instagram requires a public video URL. Upload to temporary storage first.',
      }
    }
  }

  // Post to LinkedIn
  if (
    platforms.includes('linkedin') &&
    linkedinAccessToken &&
    linkedinOrganizationUrn
  ) {
    results.linkedin = await uploadVideoToLinkedIn(
      linkedinAccessToken,
      linkedinOrganizationUrn,
      videoOptions
    )
  }

  return results
}
