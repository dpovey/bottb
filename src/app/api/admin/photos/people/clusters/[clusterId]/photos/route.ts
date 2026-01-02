import { NextRequest, NextResponse } from 'next/server'
import { getPhotosByPerson } from '@/lib/db'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'

const handleGetClusterPhotos: ProtectedApiHandler = async (
  request: NextRequest,
  context: { params: Promise<{ clusterId: string }> }
) => {
  try {
    const { clusterId } = await context.params

    if (!clusterId) {
      return NextResponse.json(
        { error: 'Cluster ID is required' },
        { status: 400 }
      )
    }

    // Get all photos for this person cluster
    const photos = await getPhotosByPerson(clusterId)

    return NextResponse.json({
      photos,
      count: photos.length,
      cluster_id: clusterId,
    })
  } catch (error) {
    console.error('Error fetching cluster photos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cluster photos' },
      { status: 500 }
    )
  }
}

export const GET = withAdminProtection(handleGetClusterPhotos)
