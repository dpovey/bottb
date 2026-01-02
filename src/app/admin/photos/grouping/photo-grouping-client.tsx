'use client'

import { useState, useEffect } from 'react'
import type { PhotoCluster, Photo } from '@/lib/db-types'

interface ClusterWithPhoto extends PhotoCluster {
  photo_count?: number
  representative_photo?: {
    id: string
    original_filename: string | null
    blob_url: string
    thumbnail_url: string | null
  } | null
}

export function PhotoGroupingClient() {
  const [nearDuplicates, setNearDuplicates] = useState<ClusterWithPhoto[]>([])
  const [scenes, setScenes] = useState<ClusterWithPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCluster, setSelectedCluster] =
    useState<ClusterWithPhoto | null>(null)
  const [clusterPhotos, setClusterPhotos] = useState<Photo[]>([])

  useEffect(() => {
    async function loadClusters() {
      try {
        const [nearDupRes, scenesRes] = await Promise.all([
          fetch('/api/admin/photos/clusters?type=near_duplicate'),
          fetch('/api/admin/photos/clusters?type=scene'),
        ])

        if (nearDupRes.ok) {
          const nearDupData = await nearDupRes.json()
          setNearDuplicates(nearDupData.clusters || [])
        }

        if (scenesRes.ok) {
          const scenesData = await scenesRes.json()
          setScenes(scenesData.clusters || [])
        }
      } catch (error) {
        console.error('Error loading clusters:', error)
      } finally {
        setLoading(false)
      }
    }

    loadClusters()
  }, [])

  const loadClusterPhotos = async (cluster: ClusterWithPhoto) => {
    setSelectedCluster(cluster)
    // Fetch photos for this cluster via API
    const photos = await Promise.all(
      cluster.photo_ids.map(async (photoId) => {
        try {
          const response = await fetch(`/api/photos/${photoId}`)
          if (response.ok) {
            return await response.json()
          }
          return null
        } catch {
          return null
        }
      })
    )
    setClusterPhotos(photos.filter(Boolean) as Photo[])
  }

  if (loading) {
    return <div className="p-6">Loading clusters...</div>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Near Duplicates */}
        <div className="bg-bg-elevated rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Near Duplicates</h2>
          <p className="text-muted mb-4">
            {nearDuplicates.length} clusters found
          </p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {nearDuplicates.map((cluster) => (
              <button
                key={cluster.id}
                onClick={() => loadClusterPhotos(cluster)}
                className="w-full text-left p-3 rounded bg-bg hover:bg-bg-hover transition-colors"
              >
                <div className="font-medium">
                  {cluster.photo_ids.length} photos
                </div>
                <div className="text-sm text-muted">
                  {new Date(cluster.created_at).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Scenes */}
        <div className="bg-bg-elevated rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Scene Clusters</h2>
          <p className="text-muted mb-4">{scenes.length} clusters found</p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {scenes.map((cluster) => (
              <button
                key={cluster.id}
                onClick={() => loadClusterPhotos(cluster)}
                className="w-full text-left p-3 rounded bg-bg hover:bg-bg-hover transition-colors"
              >
                <div className="font-medium">
                  {cluster.photo_ids.length} photos
                </div>
                <div className="text-sm text-muted">
                  {new Date(cluster.created_at).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Cluster Photos */}
      {selectedCluster && clusterPhotos.length > 0 && (
        <div className="bg-bg-elevated rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">
            Photos in Cluster ({clusterPhotos.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {clusterPhotos.map((photo) => (
              <div
                key={photo.id}
                className="aspect-square rounded overflow-hidden"
              >
                <img
                  src={photo.thumbnail_url || photo.blob_url}
                  alt={photo.original_filename || 'Photo'}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
