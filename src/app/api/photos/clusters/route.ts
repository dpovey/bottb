import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/sql'

/**
 * Public API endpoint for fetching photo clusters.
 * Returns clusters for grouping similar photos in the gallery.
 *
 * Query params:
 * - eventId (optional): Filter clusters to only include photos from this event
 * - types (optional): Comma-separated cluster types to fetch.
 *   Values: 'near_duplicate', 'scene'. Defaults to 'near_duplicate'.
 *
 * Response: { clusters: Array<{ id, photo_ids, representative_photo_id, cluster_type }> }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const typesParam = searchParams.get('types') || 'near_duplicate'

    // Parse and validate cluster types
    const validTypes = ['near_duplicate', 'scene']
    const requestedTypes = typesParam
      .split(',')
      .map((t) => t.trim())
      .filter((t) => validTypes.includes(t))

    if (requestedTypes.length === 0) {
      return NextResponse.json({
        clusters: [],
        total: 0,
      })
    }

    // Fetch clusters of requested types
    // If eventId is provided, only return clusters where at least one photo belongs to that event
    let clusters
    if (eventId) {
      const { rows } = await sql<{
        id: string
        photo_ids: string[]
        representative_photo_id: string | null
        cluster_type: string
      }>`
        SELECT DISTINCT pc.id, pc.photo_ids, pc.representative_photo_id, pc.cluster_type
        FROM photo_clusters pc
        JOIN photos p ON p.id = ANY(pc.photo_ids)
        WHERE pc.cluster_type = ANY(${requestedTypes}::text[])
          AND p.event_id = ${eventId}
        ORDER BY pc.id
      `
      clusters = rows
    } else {
      const { rows } = await sql<{
        id: string
        photo_ids: string[]
        representative_photo_id: string | null
        cluster_type: string
      }>`
        SELECT id, photo_ids, representative_photo_id, cluster_type
        FROM photo_clusters
        WHERE cluster_type = ANY(${requestedTypes}::text[])
        ORDER BY id
      `
      clusters = rows
    }

    return NextResponse.json({
      clusters,
      total: clusters.length,
    })
  } catch (error) {
    console.error('Error fetching photo clusters:', error)
    return NextResponse.json(
      { error: 'Failed to fetch photo clusters' },
      { status: 500 }
    )
  }
}
