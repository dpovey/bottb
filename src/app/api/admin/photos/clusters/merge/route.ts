import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/sql'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'

/**
 * POST /api/admin/photos/clusters/merge
 * Merge multiple clusters into a single cluster.
 *
 * The first cluster's representative photo and metadata will be preserved.
 * All other clusters will be deleted.
 *
 * Body:
 * - clusterIds: string[] - Array of cluster IDs to merge (at least 2)
 */
const handleMergeClusters: ProtectedApiHandler = async (
  request: NextRequest,
  _context?: unknown
) => {
  try {
    const body = await request.json()
    const clusterIds = body.clusterIds as string[]

    // Validate input
    if (!Array.isArray(clusterIds) || clusterIds.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 cluster IDs are required' },
        { status: 400 }
      )
    }

    // Fetch all clusters
    const clusterIdsLiteral = `{${clusterIds.join(',')}}`
    const { rows: clusters } = await sql<{
      id: string
      cluster_type: string
      photo_ids: string[]
      representative_photo_id: string | null
      metadata: Record<string, unknown> | null
    }>`
      SELECT id, cluster_type, photo_ids, representative_photo_id, metadata
      FROM photo_clusters
      WHERE id = ANY(${clusterIdsLiteral}::uuid[])
      ORDER BY array_length(photo_ids, 1) DESC
    `

    if (clusters.length !== clusterIds.length) {
      return NextResponse.json(
        { error: 'Some cluster IDs do not exist' },
        { status: 400 }
      )
    }

    // Use the first cluster (largest by photo count) as the base
    const baseCluster = clusters[0]
    const otherClusters = clusters.slice(1)

    // Collect all unique photo IDs from all clusters
    const allPhotoIds = new Set<string>(baseCluster.photo_ids)
    for (const cluster of otherClusters) {
      for (const photoId of cluster.photo_ids) {
        allPhotoIds.add(photoId)
      }
    }

    // Use the base cluster's representative photo, or fall back to first photo
    const representativePhotoId =
      baseCluster.representative_photo_id || Array.from(allPhotoIds)[0]

    // Determine cluster type - if all are the same, keep it; otherwise default to 'scene'
    const clusterTypes = new Set(clusters.map((c) => c.cluster_type))
    const mergedClusterType =
      clusterTypes.size === 1 ? baseCluster.cluster_type : 'scene'

    // Build merged metadata
    const mergedMetadata = {
      ...baseCluster.metadata,
      merged_from: clusterIds,
      merged_at: new Date().toISOString(),
      original_cluster_count: clusters.length,
      // If mixing types, mark as loose (scene-like)
      tightness:
        clusterTypes.size === 1
          ? baseCluster.cluster_type === 'near_duplicate'
            ? 'tight'
            : 'loose'
          : 'loose',
    }

    // Update the base cluster with merged data
    const mergedPhotoIdsLiteral = `{${Array.from(allPhotoIds).join(',')}}`
    await sql`
      UPDATE photo_clusters
      SET photo_ids = ${mergedPhotoIdsLiteral}::uuid[],
          representative_photo_id = ${representativePhotoId}::uuid,
          cluster_type = ${mergedClusterType},
          metadata = ${JSON.stringify(mergedMetadata)}::jsonb
      WHERE id = ${baseCluster.id}::uuid
    `

    // Delete the other clusters
    const otherClusterIds = otherClusters.map((c) => c.id)
    if (otherClusterIds.length > 0) {
      const otherIdsLiteral = `{${otherClusterIds.join(',')}}`
      await sql`
        DELETE FROM photo_clusters
        WHERE id = ANY(${otherIdsLiteral}::uuid[])
      `
    }

    // Fetch and return the updated cluster
    const { rows: updatedRows } = await sql`
      SELECT * FROM photo_clusters WHERE id = ${baseCluster.id}::uuid
    `

    return NextResponse.json({
      cluster: updatedRows[0],
      message: `Merged ${clusters.length} clusters into one with ${allPhotoIds.size} photos`,
      mergedPhotoCount: allPhotoIds.size,
      deletedClusterCount: otherClusters.length,
    })
  } catch (error) {
    console.error('Error merging clusters:', error)
    return NextResponse.json(
      { error: 'Failed to merge clusters' },
      { status: 500 }
    )
  }
}

export const POST = withAdminProtection(handleMergeClusters)
