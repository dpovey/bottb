import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/sql'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'

interface RouteContext {
  params: Promise<{ clusterId: string }>
}

/**
 * GET /api/admin/photos/clusters/:clusterId
 * Get a single cluster with its photos
 */
const handleGetCluster: ProtectedApiHandler = async (
  _request: NextRequest,
  context?: unknown
) => {
  try {
    const { clusterId } = await (context as RouteContext).params

    const { rows } = await sql`
      SELECT 
        pc.*,
        json_agg(
          json_build_object(
            'id', p.id,
            'blob_url', p.blob_url,
            'thumbnail_url', COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')),
            'original_filename', p.original_filename,
            'hero_focal_point', p.hero_focal_point,
            'is_monochrome', p.is_monochrome,
            'captured_at', p.captured_at,
            'event_id', p.event_id,
            'band_id', p.band_id
          )
          ORDER BY p.captured_at ASC NULLS LAST
        ) FILTER (WHERE p.id IS NOT NULL) as photos
      FROM photo_clusters pc
      LEFT JOIN photos p ON p.id = ANY(pc.photo_ids)
      WHERE pc.id = ${clusterId}::uuid
      GROUP BY pc.id
    `

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })
    }

    return NextResponse.json({ cluster: rows[0] })
  } catch (error) {
    console.error('Error fetching cluster:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cluster' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/photos/clusters/:clusterId
 * Update a cluster (add/remove photos, change representative, sync focal points)
 *
 * Body:
 * - addPhotoIds?: string[] - Photo IDs to add to cluster
 * - removePhotoIds?: string[] - Photo IDs to remove from cluster
 * - representativePhotoId?: string - New representative photo ID
 * - syncFocalPoint?: { sourcePhotoId: string } - Sync focal point from source to all photos
 */
const handlePatchCluster: ProtectedApiHandler = async (
  request: NextRequest,
  context?: unknown
) => {
  try {
    const { clusterId } = await (context as RouteContext).params
    const body = await request.json()

    // Verify cluster exists
    const { rows: existingRows } = await sql`
      SELECT * FROM photo_clusters WHERE id = ${clusterId}::uuid
    `

    if (existingRows.length === 0) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })
    }

    const cluster = existingRows[0]
    let photoIds: string[] = cluster.photo_ids

    // Handle adding photos
    if (body.addPhotoIds && Array.isArray(body.addPhotoIds)) {
      for (const photoId of body.addPhotoIds) {
        if (!photoIds.includes(photoId)) {
          photoIds.push(photoId)
        }
      }
    }

    // Handle removing photos
    if (body.removePhotoIds && Array.isArray(body.removePhotoIds)) {
      photoIds = photoIds.filter(
        (id: string) => !body.removePhotoIds.includes(id)
      )
    }

    // If cluster now has fewer than 2 photos, it should be deleted
    if (photoIds.length < 2) {
      await sql`DELETE FROM photo_clusters WHERE id = ${clusterId}::uuid`
      return NextResponse.json({
        message: 'Cluster deleted (fewer than 2 photos remaining)',
        deleted: true,
      })
    }

    // Update representative photo if requested or if current representative was removed
    let representativePhotoId =
      body.representativePhotoId || cluster.representative_photo_id
    if (representativePhotoId && !photoIds.includes(representativePhotoId)) {
      representativePhotoId = photoIds[0]
    }

    // Update the cluster
    const photoIdsLiteral = `{${photoIds.join(',')}}`
    await sql`
      UPDATE photo_clusters
      SET photo_ids = ${photoIdsLiteral}::uuid[],
          representative_photo_id = ${representativePhotoId}::uuid
      WHERE id = ${clusterId}::uuid
    `

    // Handle focal point syncing
    if (body.syncFocalPoint?.sourcePhotoId) {
      const sourcePhotoId = body.syncFocalPoint.sourcePhotoId

      // Verify source photo is in the cluster
      if (!photoIds.includes(sourcePhotoId)) {
        return NextResponse.json(
          { error: 'Source photo not in cluster' },
          { status: 400 }
        )
      }

      // Get source photo's focal point
      const { rows: sourceRows } = await sql`
        SELECT hero_focal_point FROM photos WHERE id = ${sourcePhotoId}::uuid
      `

      if (sourceRows.length === 0) {
        return NextResponse.json(
          { error: 'Source photo not found' },
          { status: 404 }
        )
      }

      const focalPoint = sourceRows[0].hero_focal_point

      // Update all photos in the cluster with the same focal point
      const otherPhotoIds = photoIds.filter(
        (id: string) => id !== sourcePhotoId
      )
      if (otherPhotoIds.length > 0) {
        const otherIdsLiteral = `{${otherPhotoIds.join(',')}}`
        await sql`
          UPDATE photos
          SET hero_focal_point = ${JSON.stringify(focalPoint)}::jsonb
          WHERE id = ANY(${otherIdsLiteral}::uuid[])
        `
      }
    }

    // Fetch updated cluster
    const { rows: updatedRows } = await sql`
      SELECT * FROM photo_clusters WHERE id = ${clusterId}::uuid
    `

    return NextResponse.json({
      cluster: updatedRows[0],
      message: 'Cluster updated successfully',
    })
  } catch (error) {
    console.error('Error updating cluster:', error)
    return NextResponse.json(
      { error: 'Failed to update cluster' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/photos/clusters/:clusterId
 * Delete a cluster (ungroup all photos)
 */
const handleDeleteCluster: ProtectedApiHandler = async (
  _request: NextRequest,
  context?: unknown
) => {
  try {
    const { clusterId } = await (context as RouteContext).params

    const { rowCount } = await sql`
      DELETE FROM photo_clusters WHERE id = ${clusterId}::uuid
    `

    if (rowCount === 0) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })
    }

    return NextResponse.json({
      message: 'Cluster deleted successfully',
      deleted: true,
    })
  } catch (error) {
    console.error('Error deleting cluster:', error)
    return NextResponse.json(
      { error: 'Failed to delete cluster' },
      { status: 500 }
    )
  }
}

export const GET = withAdminProtection(handleGetCluster)
export const PATCH = withAdminProtection(handlePatchCluster)
export const DELETE = withAdminProtection(handleDeleteCluster)
