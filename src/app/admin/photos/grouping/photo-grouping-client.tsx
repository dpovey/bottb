'use client'

import { useState, useEffect, useCallback } from 'react'
import { FocalPointEditor } from '@/components/photos/focal-point-editor'

interface ClusterWithPhotos {
  id: string
  cluster_type: 'near_duplicate' | 'scene'
  photo_ids: string[]
  representative_photo_id: string | null
  photos?: Array<{
    id: string
    blob_url: string
    thumbnail_url: string | null
    original_filename: string | null
    hero_focal_point: { x: number; y: number }
    is_monochrome: boolean | null
  }>
  photo_count?: number
  representative_photo?: {
    id: string
    original_filename: string | null
    blob_url: string
    thumbnail_url: string | null
  } | null
}

export function PhotoGroupingClient() {
  const [nearDuplicates, setNearDuplicates] = useState<ClusterWithPhotos[]>([])
  const [scenes, setScenes] = useState<ClusterWithPhotos[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCluster, setSelectedCluster] =
    useState<ClusterWithPhotos | null>(null)
  const [selectedPhotoForFocal, setSelectedPhotoForFocal] = useState<
    | (ClusterWithPhotos['photos'] extends (infer T)[] | undefined ? T : never)
    | null
  >(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const loadClusters = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    loadClusters()
  }, [loadClusters])

  const loadClusterDetail = async (cluster: ClusterWithPhotos) => {
    try {
      const response = await fetch(`/api/admin/photos/clusters/${cluster.id}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedCluster(data.cluster)
      }
    } catch (error) {
      console.error('Error loading cluster detail:', error)
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleRemovePhoto = async (photoId: string) => {
    if (!selectedCluster) return

    setActionLoading(true)
    try {
      const response = await fetch(
        `/api/admin/photos/clusters/${selectedCluster.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ removePhotoIds: [photoId] }),
        }
      )

      const data = await response.json()

      if (response.ok) {
        if (data.deleted) {
          // Cluster was deleted
          setSelectedCluster(null)
          showMessage('success', 'Photo removed, cluster dissolved')
        } else {
          // Update local state
          setSelectedCluster(data.cluster)
          showMessage('success', 'Photo removed from cluster')
        }
        loadClusters()
      } else {
        showMessage('error', data.error || 'Failed to remove photo')
      }
    } catch (_error) {
      showMessage('error', 'Failed to remove photo')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteCluster = async () => {
    if (!selectedCluster) return
    if (
      !confirm(
        'Are you sure you want to delete this cluster? This will ungroup all photos.'
      )
    )
      return

    setActionLoading(true)
    try {
      const response = await fetch(
        `/api/admin/photos/clusters/${selectedCluster.id}`,
        {
          method: 'DELETE',
        }
      )

      if (response.ok) {
        setSelectedCluster(null)
        showMessage('success', 'Cluster deleted')
        loadClusters()
      } else {
        const data = await response.json()
        showMessage('error', data.error || 'Failed to delete cluster')
      }
    } catch (_error) {
      showMessage('error', 'Failed to delete cluster')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSetRepresentative = async (photoId: string) => {
    if (!selectedCluster) return

    setActionLoading(true)
    try {
      const response = await fetch(
        `/api/admin/photos/clusters/${selectedCluster.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ representativePhotoId: photoId }),
        }
      )

      if (response.ok) {
        const data = await response.json()
        setSelectedCluster(data.cluster)
        showMessage('success', 'Representative photo updated')
        loadClusters()
      } else {
        const data = await response.json()
        showMessage('error', data.error || 'Failed to update')
      }
    } catch (_error) {
      showMessage('error', 'Failed to update')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSyncFocalPoint = async (sourcePhotoId: string) => {
    if (!selectedCluster) return

    setActionLoading(true)
    try {
      const response = await fetch(
        `/api/admin/photos/clusters/${selectedCluster.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ syncFocalPoint: { sourcePhotoId } }),
        }
      )

      if (response.ok) {
        showMessage('success', 'Focal points synced to all photos in cluster')
        // Reload cluster to get updated focal points
        loadClusterDetail(selectedCluster)
      } else {
        const data = await response.json()
        showMessage('error', data.error || 'Failed to sync focal points')
      }
    } catch (_error) {
      showMessage('error', 'Failed to sync focal points')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSaveFocalPoint = async (
    photoId: string,
    focalPoint: { x: number; y: number }
  ) => {
    const response = await fetch(`/api/photos/${photoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heroFocalPoint: focalPoint }),
    })

    if (!response.ok) {
      throw new Error('Failed to save focal point')
    }

    // Update local state
    if (selectedCluster && selectedCluster.photos) {
      setSelectedCluster({
        ...selectedCluster,
        photos: selectedCluster.photos.map((p) =>
          p.id === photoId ? { ...p, hero_focal_point: focalPoint } : p
        ),
      })
    }
  }

  if (loading) {
    return <div className="p-6">Loading clusters...</div>
  }

  return (
    <div className="space-y-6">
      {/* Message toast */}
      {message && (
        <div
          className={`fixed top-4 right-4 px-4 py-2 rounded-lg z-50 ${
            message.type === 'success'
              ? 'bg-success/20 text-success'
              : 'bg-error/20 text-error'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Near Duplicates */}
        <ClusterList
          title="Near Duplicates"
          clusters={nearDuplicates}
          selectedCluster={selectedCluster}
          onSelectCluster={loadClusterDetail}
        />

        {/* Scenes */}
        <ClusterList
          title="Scene Clusters"
          clusters={scenes}
          selectedCluster={selectedCluster}
          onSelectCluster={loadClusterDetail}
        />
      </div>

      {/* Selected Cluster Detail */}
      {selectedCluster && selectedCluster.photos && (
        <div className="bg-bg-elevated rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {selectedCluster.cluster_type === 'near_duplicate'
                ? 'Near Duplicate'
                : 'Scene'}{' '}
              Cluster ({selectedCluster.photos.length} photos)
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedCluster(null)}
                className="px-3 py-1.5 bg-bg hover:bg-bg-hover rounded-lg text-sm"
              >
                Close
              </button>
              <button
                onClick={handleDeleteCluster}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-error/20 hover:bg-error/30 text-error rounded-lg text-sm disabled:opacity-50"
              >
                Delete Cluster
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {selectedCluster.photos.map((photo) => (
              <div
                key={photo.id}
                className={`relative rounded overflow-hidden group ${
                  photo.id === selectedCluster.representative_photo_id
                    ? 'ring-2 ring-accent'
                    : ''
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumbnail_url || photo.blob_url}
                  alt={photo.original_filename || 'Photo'}
                  className="w-full aspect-square object-cover"
                />

                {/* Representative badge */}
                {photo.id === selectedCluster.representative_photo_id && (
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-accent text-white text-xs rounded">
                    Rep
                  </div>
                )}

                {/* Monochrome badge */}
                {photo.is_monochrome !== null && (
                  <div
                    className={`absolute top-1 right-1 px-1.5 py-0.5 text-xs rounded ${
                      photo.is_monochrome
                        ? 'bg-gray-500 text-white'
                        : 'bg-blue-500 text-white'
                    }`}
                  >
                    {photo.is_monochrome ? 'B&W' : 'Color'}
                  </div>
                )}

                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                  {photo.id !== selectedCluster.representative_photo_id && (
                    <button
                      onClick={() => handleSetRepresentative(photo.id)}
                      disabled={actionLoading}
                      className="w-full px-2 py-1 bg-accent hover:bg-accent-light text-white text-xs rounded"
                    >
                      Set as Rep
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedPhotoForFocal(photo)}
                    className="w-full px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded"
                  >
                    Edit Focal
                  </button>
                  <button
                    onClick={() => handleSyncFocalPoint(photo.id)}
                    disabled={actionLoading}
                    className="w-full px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded"
                  >
                    Sync Focal
                  </button>
                  <button
                    onClick={() => handleRemovePhoto(photo.id)}
                    disabled={actionLoading}
                    className="w-full px-2 py-1 bg-error hover:bg-error/80 text-white text-xs rounded"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Focal Point Editor Modal */}
      {selectedPhotoForFocal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-elevated rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Focal Point</h3>
              <button
                onClick={() => setSelectedPhotoForFocal(null)}
                className="px-3 py-1.5 bg-bg hover:bg-bg-hover rounded-lg"
              >
                Close
              </button>
            </div>
            <FocalPointEditor
              imageUrl={selectedPhotoForFocal.blob_url}
              initialFocalPoint={selectedPhotoForFocal.hero_focal_point}
              onSave={async (focalPoint) => {
                await handleSaveFocalPoint(selectedPhotoForFocal.id, focalPoint)
                setSelectedPhotoForFocal(null)
                showMessage('success', 'Focal point saved')
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ClusterList({
  title,
  clusters,
  selectedCluster,
  onSelectCluster,
}: {
  title: string
  clusters: ClusterWithPhotos[]
  selectedCluster: ClusterWithPhotos | null
  onSelectCluster: (cluster: ClusterWithPhotos) => void
}) {
  return (
    <div className="bg-bg-elevated rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <p className="text-muted mb-4">{clusters.length} clusters found</p>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {clusters.map((cluster) => (
          <button
            key={cluster.id}
            onClick={() => onSelectCluster(cluster)}
            className={`w-full text-left p-3 rounded transition-colors ${
              selectedCluster?.id === cluster.id
                ? 'bg-accent/20 border border-accent'
                : 'bg-bg hover:bg-bg-hover'
            }`}
          >
            <div className="flex items-center gap-3">
              {cluster.representative_photo?.thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cluster.representative_photo.thumbnail_url}
                  alt=""
                  className="w-12 h-12 object-cover rounded"
                />
              )}
              <div>
                <div className="font-medium">
                  {cluster.photo_ids?.length || cluster.photo_count} photos
                </div>
                <div className="text-sm text-muted">
                  {cluster.representative_photo?.original_filename ||
                    'No filename'}
                </div>
              </div>
            </div>
          </button>
        ))}
        {clusters.length === 0 && (
          <div className="text-muted text-center py-4">No clusters found</div>
        )}
      </div>
    </div>
  )
}
