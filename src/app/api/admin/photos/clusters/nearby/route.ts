import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/sql'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'

/**
 * GET /api/admin/photos/clusters/nearby
 * Find photos that are temporally close to a time range, for adding to clusters.
 *
 * Query params:
 * - startTime: ISO timestamp for start of time window
 * - endTime: ISO timestamp for end of time window
 * - excludeIds: Comma-separated photo IDs to exclude (current cluster members)
 * - eventId: Optional - filter to same event
 * - bandId: Optional - filter to same band
 * - limit: Optional - max photos to return (default 50)
 */
const handleGetNearbyPhotos: ProtectedApiHandler = async (
  request: NextRequest,
  _context?: unknown
) => {
  try {
    const { searchParams } = new URL(request.url)
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')
    const excludeIdsParam = searchParams.get('excludeIds')
    const eventId = searchParams.get('eventId')
    const bandId = searchParams.get('bandId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: 'startTime and endTime are required' },
        { status: 400 }
      )
    }

    // Parse exclude IDs
    const excludeIds = excludeIdsParam
      ? excludeIdsParam.split(',').filter((id) => id.trim())
      : []

    // Build query for nearby photos
    // Order by captured_at to show chronologically
    let query

    if (excludeIds.length > 0) {
      const excludeIdsLiteral = `{${excludeIds.join(',')}}`

      if (eventId && bandId) {
        query = await sql<{
          id: string
          blob_url: string
          thumbnail_url: string | null
          original_filename: string | null
          captured_at: string | null
        }>`
          SELECT 
            p.id,
            p.blob_url,
            COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url,
            p.original_filename,
            p.captured_at
          FROM photos p
          WHERE p.captured_at >= ${startTime}::timestamptz
            AND p.captured_at <= ${endTime}::timestamptz
            AND p.id != ALL(${excludeIdsLiteral}::uuid[])
            AND p.event_id = ${eventId}
            AND p.band_id = ${bandId}
          ORDER BY p.captured_at ASC
          LIMIT ${limit}
        `
      } else if (eventId) {
        query = await sql<{
          id: string
          blob_url: string
          thumbnail_url: string | null
          original_filename: string | null
          captured_at: string | null
        }>`
          SELECT 
            p.id,
            p.blob_url,
            COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url,
            p.original_filename,
            p.captured_at
          FROM photos p
          WHERE p.captured_at >= ${startTime}::timestamptz
            AND p.captured_at <= ${endTime}::timestamptz
            AND p.id != ALL(${excludeIdsLiteral}::uuid[])
            AND p.event_id = ${eventId}
          ORDER BY p.captured_at ASC
          LIMIT ${limit}
        `
      } else {
        query = await sql<{
          id: string
          blob_url: string
          thumbnail_url: string | null
          original_filename: string | null
          captured_at: string | null
        }>`
          SELECT 
            p.id,
            p.blob_url,
            COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url,
            p.original_filename,
            p.captured_at
          FROM photos p
          WHERE p.captured_at >= ${startTime}::timestamptz
            AND p.captured_at <= ${endTime}::timestamptz
            AND p.id != ALL(${excludeIdsLiteral}::uuid[])
          ORDER BY p.captured_at ASC
          LIMIT ${limit}
        `
      }
    } else {
      // No excludes
      if (eventId && bandId) {
        query = await sql<{
          id: string
          blob_url: string
          thumbnail_url: string | null
          original_filename: string | null
          captured_at: string | null
        }>`
          SELECT 
            p.id,
            p.blob_url,
            COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url,
            p.original_filename,
            p.captured_at
          FROM photos p
          WHERE p.captured_at >= ${startTime}::timestamptz
            AND p.captured_at <= ${endTime}::timestamptz
            AND p.event_id = ${eventId}
            AND p.band_id = ${bandId}
          ORDER BY p.captured_at ASC
          LIMIT ${limit}
        `
      } else if (eventId) {
        query = await sql<{
          id: string
          blob_url: string
          thumbnail_url: string | null
          original_filename: string | null
          captured_at: string | null
        }>`
          SELECT 
            p.id,
            p.blob_url,
            COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url,
            p.original_filename,
            p.captured_at
          FROM photos p
          WHERE p.captured_at >= ${startTime}::timestamptz
            AND p.captured_at <= ${endTime}::timestamptz
            AND p.event_id = ${eventId}
          ORDER BY p.captured_at ASC
          LIMIT ${limit}
        `
      } else {
        query = await sql<{
          id: string
          blob_url: string
          thumbnail_url: string | null
          original_filename: string | null
          captured_at: string | null
        }>`
          SELECT 
            p.id,
            p.blob_url,
            COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url,
            p.original_filename,
            p.captured_at
          FROM photos p
          WHERE p.captured_at >= ${startTime}::timestamptz
            AND p.captured_at <= ${endTime}::timestamptz
          ORDER BY p.captured_at ASC
          LIMIT ${limit}
        `
      }
    }

    return NextResponse.json({
      photos: query.rows,
      total: query.rows.length,
      timeRange: { startTime, endTime },
      filters: { eventId, bandId },
    })
  } catch (error) {
    console.error('Error fetching nearby photos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch nearby photos' },
      { status: 500 }
    )
  }
}

export const GET = withAdminProtection(handleGetNearbyPhotos)
