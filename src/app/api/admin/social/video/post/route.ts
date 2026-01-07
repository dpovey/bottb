/**
 * Video Social Post API
 *
 * POST /api/admin/social/video - Post a video to social platforms
 *
 * Accepts JSON with:
 * - videoUrl: URL of the video in Vercel Blob (uploaded client-side)
 * - caption: Post caption
 * - platforms: Array of platforms to post to
 * - filename: Original filename
 * - scheduledTime: (optional) ISO string for scheduled posting
 *
 * The video is uploaded client-side directly to Vercel Blob to bypass
 * the 4.5MB serverless function payload limit.
 *
 * Scheduled posting support:
 * - Facebook: ✅ Supports via scheduled_publish_time parameter
 * - Instagram: ✅ Supports via Content Publishing API (Business accounts only)
 *              Rate limit: 25 posts/24hr. See: https://developers.facebook.com/blog/post/2021/01/26/introducing-instagram-content-publishing-api/
 * - LinkedIn: ❌ No native scheduling API (would need our own job queue)
 *
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'
import { getSocialAccountWithTokens } from '@/lib/social/db'
import {
  uploadVideoToFacebook,
  uploadVideoToLinkedIn,
  uploadVideoToInstagram,
  VideoUploadResult,
} from '@/lib/social/video'
import { del } from '@vercel/blob'

type Platform = 'facebook' | 'instagram' | 'linkedin'

interface PostResult {
  facebook?: VideoUploadResult
  instagram?: VideoUploadResult
  linkedin?: VideoUploadResult
}

interface VideoPostBody {
  videoUrl: string
  caption: string
  platforms: Platform[]
  filename: string
  videoId?: string
  youtubeVideoId?: string
  scheduledTime?: string | null
}

const handleVideoPost: ProtectedApiHandler = async (request: NextRequest) => {
  let videoUrl: string | null = null

  try {
    const body: VideoPostBody = await request.json()
    const { caption, platforms, filename, scheduledTime } = body
    videoUrl = body.videoUrl

    // Validate scheduled time if provided
    let scheduledTimestamp: number | null = null
    if (scheduledTime) {
      const scheduledDate = new Date(scheduledTime)
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid scheduled time format' },
          { status: 400 }
        )
      }
      // Must be at least 10 minutes in the future
      const minScheduleTime = Date.now() + 10 * 60 * 1000
      if (scheduledDate.getTime() < minScheduleTime) {
        return NextResponse.json(
          { error: 'Scheduled time must be at least 10 minutes in the future' },
          { status: 400 }
        )
      }
      scheduledTimestamp = Math.floor(scheduledDate.getTime() / 1000)
    }

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Video URL is required' },
        { status: 400 }
      )
    }

    if (!caption) {
      return NextResponse.json(
        { error: 'Caption is required' },
        { status: 400 }
      )
    }

    if (!platforms || platforms.length === 0) {
      return NextResponse.json(
        { error: 'At least one platform is required' },
        { status: 400 }
      )
    }

    const results: PostResult = {}

    // For Facebook and LinkedIn, we need to download the video and re-upload
    // Instagram can use the public URL directly
    let videoBlob: Blob | null = null

    if (platforms.includes('facebook') || platforms.includes('linkedin')) {
      try {
        console.log(`[Video] Downloading video from blob: ${videoUrl}`)
        const response = await fetch(videoUrl)
        if (!response.ok) {
          throw new Error(`Failed to fetch video: ${response.statusText}`)
        }
        videoBlob = await response.blob()
        console.log(`[Video] Downloaded video: ${videoBlob.size} bytes`)
      } catch (error) {
        console.error('Failed to download video from blob:', error)
        const errorMsg =
          error instanceof Error
            ? error.message
            : 'Failed to download video for posting'
        if (platforms.includes('facebook')) {
          results.facebook = { success: false, error: errorMsg }
        }
        if (platforms.includes('linkedin')) {
          results.linkedin = { success: false, error: errorMsg }
        }
      }
    }

    // Post to Facebook (supports scheduling)
    if (platforms.includes('facebook') && videoBlob) {
      try {
        const account = await getSocialAccountWithTokens('facebook')
        if (!account || account.status !== 'active') {
          throw new Error('Facebook account not connected or inactive')
        }

        results.facebook = await uploadVideoToFacebook(
          account.provider_account_id,
          account.access_token,
          {
            caption,
            videoFile: videoBlob,
            filename,
            scheduledPublishTime: scheduledTimestamp || undefined,
          }
        )
      } catch (error) {
        results.facebook = {
          success: false,
          error:
            error instanceof Error ? error.message : 'Facebook post failed',
        }
      }
    }

    // Post to Instagram (uses the public URL directly)
    // Instagram Business accounts support scheduling via Content Publishing API
    // Rate limit: 25 API-published posts per 24-hour period
    if (platforms.includes('instagram')) {
      try {
        const account = await getSocialAccountWithTokens('instagram')
        if (!account || account.status !== 'active') {
          throw new Error('Instagram account not connected or inactive')
        }

        results.instagram = await uploadVideoToInstagram(
          account.provider_account_id,
          account.access_token,
          videoUrl,
          {
            caption,
            scheduledPublishTime: scheduledTimestamp || undefined,
          }
        )
      } catch (error) {
        results.instagram = {
          success: false,
          error:
            error instanceof Error ? error.message : 'Instagram post failed',
        }
      }
    }

    // Post to LinkedIn
    // Note: LinkedIn API does not support scheduled publishing for organization posts
    if (platforms.includes('linkedin') && videoBlob) {
      if (scheduledTimestamp) {
        results.linkedin = {
          success: false,
          error:
            'LinkedIn does not support scheduled posting via API. Post immediately or schedule manually.',
        }
      } else {
        try {
          const account = await getSocialAccountWithTokens('linkedin')
          if (!account || account.status !== 'active') {
            throw new Error('LinkedIn account not connected or inactive')
          }

          if (!account.organization_urn) {
            throw new Error('LinkedIn organization not configured')
          }

          results.linkedin = await uploadVideoToLinkedIn(
            account.access_token,
            account.organization_urn,
            {
              caption,
              videoFile: videoBlob,
              filename,
            }
          )
        } catch (error) {
          results.linkedin = {
            success: false,
            error:
              error instanceof Error ? error.message : 'LinkedIn post failed',
          }
        }
      }
    }

    // Determine overall status
    const hasSuccess = Object.values(results).some((r) => r?.success)
    const hasFailure = Object.values(results).some((r) => r && !r.success)

    let status: 'success' | 'partial' | 'failed'
    if (hasSuccess && !hasFailure) {
      status = 'success'
    } else if (hasSuccess && hasFailure) {
      status = 'partial'
    } else {
      status = 'failed'
    }

    // Clean up: Delete the video from blob storage after all platforms have processed
    if (videoUrl) {
      try {
        await del(videoUrl)
        console.log(`[Video] Deleted video from blob: ${videoUrl}`)
      } catch (cleanupError) {
        // Log but don't fail the request
        console.error('Failed to delete video from blob:', cleanupError)
      }
    }

    return NextResponse.json({
      status,
      results,
    })
  } catch (error) {
    console.error('Video post error:', error)

    // Try to clean up even on error
    if (videoUrl) {
      try {
        await del(videoUrl)
      } catch {
        // Ignore cleanup errors
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video post failed' },
      { status: 500 }
    )
  }
}

export const POST = withAdminProtection(handleVideoPost)
