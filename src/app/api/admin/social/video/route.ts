/**
 * Video Social Post API
 *
 * POST /api/admin/social/video - Upload and post a video to social platforms
 *
 * Accepts multipart form data with:
 * - video: The video file
 * - caption: Post caption
 * - platforms: JSON array of platforms to post to
 * - videoId: Database video ID (optional)
 * - youtubeVideoId: YouTube video ID (for reference)
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
import { put, del } from '@vercel/blob'

type Platform = 'facebook' | 'instagram' | 'linkedin'

interface PostResult {
  facebook?: VideoUploadResult
  instagram?: VideoUploadResult
  linkedin?: VideoUploadResult
}

const handleVideoPost: ProtectedApiHandler = async (request: NextRequest) => {
  try {
    // Parse multipart form data
    const formData = await request.formData()
    const videoFile = formData.get('video') as File | null
    const caption = formData.get('caption') as string
    const platformsJson = formData.get('platforms') as string

    if (!videoFile) {
      return NextResponse.json(
        { error: 'Video file is required' },
        { status: 400 }
      )
    }

    if (!caption) {
      return NextResponse.json(
        { error: 'Caption is required' },
        { status: 400 }
      )
    }

    let platforms: Platform[]
    try {
      platforms = JSON.parse(platformsJson)
    } catch {
      return NextResponse.json(
        { error: 'Invalid platforms format' },
        { status: 400 }
      )
    }

    if (!platforms || platforms.length === 0) {
      return NextResponse.json(
        { error: 'At least one platform is required' },
        { status: 400 }
      )
    }

    // Convert File to Blob for our upload functions
    const videoBlob = videoFile as Blob
    const filename = videoFile.name

    const results: PostResult = {}

    // For Instagram, we need to upload to a public URL first
    // We'll delete this temp file after Instagram processes it
    let tempBlobUrl: string | null = null
    if (platforms.includes('instagram')) {
      try {
        // Upload to Vercel Blob for temporary public hosting
        const blob = await put(
          `videos/temp-${Date.now()}-${filename}`,
          videoFile,
          {
            access: 'public',
            addRandomSuffix: true,
          }
        )
        tempBlobUrl = blob.url
        console.log(`[Video] Uploaded temp video to blob: ${tempBlobUrl}`)
      } catch (error) {
        console.error('Failed to upload video to blob storage:', error)
        results.instagram = {
          success: false,
          error:
            'Failed to upload video for Instagram. Blob storage may not be configured.',
        }
      }
    }

    // Post to Facebook
    if (platforms.includes('facebook')) {
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

    // Post to Instagram
    if (platforms.includes('instagram') && tempBlobUrl) {
      try {
        const account = await getSocialAccountWithTokens('instagram')
        if (!account || account.status !== 'active') {
          throw new Error('Instagram account not connected or inactive')
        }

        results.instagram = await uploadVideoToInstagram(
          account.provider_account_id,
          account.access_token,
          tempBlobUrl,
          { caption }
        )
      } catch (error) {
        results.instagram = {
          success: false,
          error:
            error instanceof Error ? error.message : 'Instagram post failed',
        }
      }

      // Clean up: Delete the temp video from blob storage
      // Instagram has already fetched it by now (uploadVideoToInstagram waits for processing)
      try {
        await del(tempBlobUrl)
        console.log(`[Video] Deleted temp video from blob: ${tempBlobUrl}`)
      } catch (cleanupError) {
        // Log but don't fail the request - the post already succeeded
        console.error('Failed to delete temp video from blob:', cleanupError)
      }
    }

    // Post to LinkedIn
    if (platforms.includes('linkedin')) {
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

    return NextResponse.json({
      status,
      results,
    })
  } catch (error) {
    console.error('Video post error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video post failed' },
      { status: 500 }
    )
  }
}

export const POST = withAdminProtection(handleVideoPost)
