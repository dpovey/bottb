/**
 * Video Upload Token API
 *
 * POST /api/admin/social/video/upload - Get a client upload token for Vercel Blob
 *
 * This enables client-side uploads directly to Vercel Blob,
 * bypassing the 4.5MB serverless function limit.
 *
 * Note: This endpoint cannot use withAdminProtection because
 * handleUpload needs to consume the request body directly.
 * Admin check is done manually below.
 */

import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { auth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  // Manual admin check (can't use wrapper because handleUpload needs the raw request)
  const session = await auth()
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as HandleUploadBody

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Validate the upload path
        if (!pathname.startsWith('videos/')) {
          throw new Error('Invalid upload path')
        }

        return {
          allowedContentTypes: [
            'video/mp4',
            'video/quicktime',
            'video/x-msvideo',
            'video/webm',
            'video/x-matroska',
          ],
          maximumSizeInBytes: 1024 * 1024 * 1024, // 1GB max
          tokenPayload: JSON.stringify({
            uploadedAt: new Date().toISOString(),
          }),
        }
      },
      onUploadCompleted: async ({ blob }) => {
        // Log successful upload
        console.log(`[Video] Client upload completed: ${blob.url}`)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error('Video upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 }
    )
  }
}
