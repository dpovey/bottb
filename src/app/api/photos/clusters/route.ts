import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/sql'

/**
 * Public API endpoint for fetching photo clusters.
 * Returns near-duplicate clusters for grouping similar photos in the gallery.
 *
 * Query params:
 * - eventId (optional): Filter clusters to only include photos from this event
 *
 * Response: { clusters: Array<{ id, photo_ids, representative_photo_id }> }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    // Fetch near-duplicate clusters
    // If eventId is provided, only return clusters where at least one photo belongs to that event
    let clusters
    if (eventId) {
      const { rows } = await sql<{
        id: string
        photo_ids: string[]
        representative_photo_id: string | null
      }>`
        SELECT DISTINCT pc.id, pc.photo_ids, pc.representative_photo_id
        FROM photo_clusters pc
        JOIN photos p ON p.id = ANY(pc.photo_ids)
        WHERE pc.cluster_type = 'near_duplicate'
          AND p.event_id = ${eventId}
        ORDER BY pc.id
      `
      clusters = rows
    } else {
      const { rows } = await sql<{
        id: string
        photo_ids: string[]
        representative_photo_id: string | null
      }>`
        SELECT id, photo_ids, representative_photo_id
        FROM photo_clusters
        WHERE cluster_type = 'near_duplicate'
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
