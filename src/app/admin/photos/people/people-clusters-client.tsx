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
  representative_face?: {
    filename: string
    box: { x: number; y: number; width: number; height: number }
    quality_score: number
  } | null
}

export function PeopleClustersClient() {
  const [clusters, setClusters] = useState<ClusterWithPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCluster, setSelectedCluster] =
    useState<ClusterWithPhoto | null>(null)
  const [clusterPhotos, setClusterPhotos] = useState<Photo[]>([])

  useEffect(() => {
    async function loadClusters() {
      try {
        const response = await fetch('/api/admin/photos/people/clusters')
        if (response.ok) {
          const data = await response.json()
          setClusters(data.clusters || [])
        }
      } catch (error) {
        console.error('Error loading people clusters:', error)
      } finally {
        setLoading(false)
      }
    }

    loadClusters()
  }, [])

  const loadClusterPhotos = async (cluster: ClusterWithPhoto) => {
    setSelectedCluster(cluster)
    try {
      const response = await fetch(
        `/api/admin/photos/people/clusters/${cluster.id}/photos`
      )
      if (response.ok) {
        const data = await response.json()
        setClusterPhotos(data.photos || [])
      }
    } catch (error) {
      console.error('Error loading cluster photos:', error)
      setClusterPhotos([])
    }
  }

  if (loading) {
    return <div className="p-6">Loading people clusters...</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-bg-elevated rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Person Clusters</h2>
        <p className="text-muted mb-4">{clusters.length} people identified</p>
        {clusters.length === 0 ? (
          <p className="text-muted">
            No people clusters found. This may indicate that face detection or
            clustering needs adjustment.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clusters.map((cluster) => {
              const personId =
                (cluster.metadata as { person_id?: number })?.person_id ?? 0
              return (
                <button
                  key={cluster.id}
                  onClick={() => loadClusterPhotos(cluster)}
                  className="text-left p-4 rounded bg-bg hover:bg-bg-hover transition-colors"
                >
                  <div className="font-medium">Person {personId}</div>
                  <div className="text-sm text-muted">
                    {cluster.photo_count || cluster.photo_ids.length} photos
                  </div>
                  {cluster.representative_face && (
                    <div className="text-xs text-muted mt-1">
                      Quality:{' '}
                      {cluster.representative_face.quality_score?.toFixed(2) ||
                        'N/A'}
                    </div>
                  )}
                  <div className="text-xs text-muted mt-1">
                    {new Date(cluster.created_at).toLocaleDateString()}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Selected Cluster Photos */}
      {selectedCluster && clusterPhotos.length > 0 && (
        <div className="bg-bg-elevated rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">
            Photos of This Person ({clusterPhotos.length})
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
