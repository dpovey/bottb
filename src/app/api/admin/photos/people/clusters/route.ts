import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/sql'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'
import type { PhotoCluster } from '@/lib/db-types'

const handleGetPeopleClusters: ProtectedApiHandler = async (
  _request: NextRequest,
  _context?: unknown
) => {
  try {
    // Get all person clusters with photo count and event IDs
    const { rows } = await sql<
      PhotoCluster & { photo_count: number; event_ids: string[] }
    >`
      SELECT 
        pc.*,
        COUNT(DISTINCT p.id) as photo_count,
        ARRAY_AGG(DISTINCT p.event_id) FILTER (WHERE p.event_id IS NOT NULL) as event_ids
      FROM photo_clusters pc
      LEFT JOIN photos p ON p.id = ANY(pc.photo_ids)
      WHERE pc.cluster_type = 'person'
      GROUP BY pc.id
      ORDER BY pc.created_at DESC
    `

    // Enrich clusters with representative face info and photo metadata
    const clusters = await Promise.all(
      rows.map(async (cluster) => {
        let representativePhoto = null
        let representativeFace = null

        // Get representative photo if specified
        if (cluster.representative_photo_id) {
          const { rows: photoRows } = await sql`
            SELECT 
              id,
              original_filename,
              blob_url,
              event_id,
              COALESCE(xmp_metadata->>'thumbnail_url', REPLACE(blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
            FROM photos
            WHERE id = ${cluster.representative_photo_id}::uuid
            LIMIT 1
          `
          representativePhoto = photoRows[0] || null
        } else if (cluster.photo_ids.length > 0) {
          // Use first photo as representative if none specified
          const { rows: photoRows } = await sql`
            SELECT 
              id,
              original_filename,
              blob_url,
              event_id,
              COALESCE(xmp_metadata->>'thumbnail_url', REPLACE(blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
            FROM photos
            WHERE id = ${cluster.photo_ids[0]}::uuid
            LIMIT 1
          `
          representativePhoto = photoRows[0] || null
        }

        // Extract representative face info from metadata
        if (cluster.metadata && typeof cluster.metadata === 'object') {
          const metadata = cluster.metadata as Record<string, unknown>
          if (metadata.representative_face) {
            representativeFace = metadata.representative_face
          }
        }

        return {
          ...cluster,
          photo_count: parseInt(cluster.photo_count.toString(), 10),
          event_ids: cluster.event_ids || [],
          representative_photo: representativePhoto,
          representative_face: representativeFace,
        }
      })
    )

    return NextResponse.json({
      clusters,
      total: clusters.length,
    })
  } catch (error) {
    console.error('Error fetching people clusters:', error)
    return NextResponse.json(
      { error: 'Failed to fetch people clusters' },
      { status: 500 }
    )
  }
}

export const GET = withAdminProtection(handleGetPeopleClusters)
