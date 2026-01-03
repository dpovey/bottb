import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/sql'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'
import type { PhotoCluster } from '@/lib/db-types'

const handleGetClusters: ProtectedApiHandler = async (
  request: NextRequest,
  _context?: unknown
) => {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'near_duplicate' | 'scene' | null

    if (!type || (type !== 'near_duplicate' && type !== 'scene')) {
      return NextResponse.json(
        {
          error: 'Invalid or missing type parameter',
          message: 'Type must be "near_duplicate" or "scene"',
        },
        { status: 400 }
      )
    }

    // Get clusters with photo metadata
    const { rows } = await sql<PhotoCluster & { photo_count: number }>`
      SELECT 
        pc.*,
        COUNT(DISTINCT p.id) as photo_count
      FROM photo_clusters pc
      LEFT JOIN photos p ON p.id = ANY(pc.photo_ids)
      WHERE pc.cluster_type = ${type}
      GROUP BY pc.id
      ORDER BY pc.created_at DESC
    `

    // Enrich clusters with representative photo info
    const clusters = await Promise.all(
      rows.map(async (cluster) => {
        let representativePhoto = null
        if (cluster.representative_photo_id) {
          const { rows: photoRows } = await sql`
            SELECT 
              id,
              original_filename,
              blob_url,
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
              COALESCE(xmp_metadata->>'thumbnail_url', REPLACE(blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
            FROM photos
            WHERE id = ${cluster.photo_ids[0]}::uuid
            LIMIT 1
          `
          representativePhoto = photoRows[0] || null
        }

        return {
          ...cluster,
          photo_count: parseInt(cluster.photo_count.toString(), 10),
          representative_photo: representativePhoto,
        }
      })
    )

    return NextResponse.json({
      clusters,
      total: clusters.length,
      type,
    })
  } catch (error) {
    console.error('Error fetching photo clusters:', error)
    return NextResponse.json(
      { error: 'Failed to fetch photo clusters' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/photos/clusters
 * Create a new cluster (manually group photos)
 *
 * Body:
 * - clusterType: 'near_duplicate' | 'scene'
 * - photoIds: string[] - Array of at least 2 photo IDs to group
 * - representativePhotoId?: string - Optional representative photo ID (defaults to first)
 */
const handleCreateCluster: ProtectedApiHandler = async (
  request: NextRequest,
  _context?: unknown
) => {
  try {
    const body = await request.json()

    // Validate cluster type
    const clusterType = body.clusterType as 'near_duplicate' | 'scene'
    if (clusterType !== 'near_duplicate' && clusterType !== 'scene') {
      return NextResponse.json(
        { error: 'clusterType must be "near_duplicate" or "scene"' },
        { status: 400 }
      )
    }

    // Validate photo IDs
    const photoIds = body.photoIds as string[]
    if (!Array.isArray(photoIds) || photoIds.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 photo IDs required' },
        { status: 400 }
      )
    }

    // Verify all photos exist
    const photoIdsLiteral = `{${photoIds.join(',')}}`
    const { rows: existingPhotos } = await sql`
      SELECT id FROM photos WHERE id = ANY(${photoIdsLiteral}::uuid[])
    `

    if (existingPhotos.length !== photoIds.length) {
      return NextResponse.json(
        { error: 'Some photo IDs do not exist' },
        { status: 400 }
      )
    }

    // Set representative photo
    const representativePhotoId =
      body.representativePhotoId &&
      photoIds.includes(body.representativePhotoId)
        ? body.representativePhotoId
        : photoIds[0]

    // Create the cluster
    const { rows } = await sql`
      INSERT INTO photo_clusters (
        cluster_type, photo_ids, representative_photo_id, metadata
      ) VALUES (
        ${clusterType},
        ${photoIdsLiteral}::uuid[],
        ${representativePhotoId}::uuid,
        ${JSON.stringify({ source: 'manual' })}::jsonb
      )
      RETURNING *
    `

    return NextResponse.json({
      cluster: rows[0],
      message: 'Cluster created successfully',
    })
  } catch (error) {
    console.error('Error creating cluster:', error)
    return NextResponse.json(
      { error: 'Failed to create cluster' },
      { status: 500 }
    )
  }
}

export const GET = withAdminProtection(handleGetClusters)
export const POST = withAdminProtection(handleCreateCluster)
