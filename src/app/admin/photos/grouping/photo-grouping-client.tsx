'use client'

import { useState, useEffect } from 'react'
import { FocalPointEditor } from '@/components/photos/focal-point-editor'
import { NearbyPhotosStrip } from './nearby-photos-strip'

interface ClusterPhoto {
  id: string
  blob_url: string
  thumbnail_url: string | null
  original_filename: string | null
  hero_focal_point: { x: number; y: number }
  is_monochrome: boolean | null
  captured_at: string | null
  event_id: string | null
  band_id: string | null
}

interface ClusterWithPhotos {
  id: string
  cluster_type: 'near_duplicate' | 'scene'
  photo_ids: string[]
  representative_photo_id: string | null
  metadata: {
    tightness?: 'tight' | 'loose'
    source?: string
    [key: string]: unknown
  } | null
  photos?: ClusterPhoto[]
  photo_count?: number
  representative_photo?: {
    id: string
    original_filename: string | null
    blob_url: string
    thumbnail_url: string | null
  } | null
}

export function PhotoGroupingClient() {
  const [clusters, setClusters] = useState<ClusterWithPhotos[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCluster, setSelectedCluster] =
    useState<ClusterWithPhotos | null>(null)
  const [selectedPhotoForFocal, setSelectedPhotoForFocal] =
    useState<ClusterPhoto | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // Multi-select mode
  const [selectMode, setSelectMode] = useState(false)
  const [selectedClusterIds, setSelectedClusterIds] = useState<Set<string>>(
    new Set()
  )

  async function loadClusters() {
    try {
      // Fetch both types and combine them
      const [nearDupRes, scenesRes] = await Promise.all([
        fetch('/api/admin/photos/clusters?type=near_duplicate'),
        fetch('/api/admin/photos/clusters?type=scene'),
      ])

      const allClusters: ClusterWithPhotos[] = []

      if (nearDupRes.ok) {
        const nearDupData = await nearDupRes.json()
        // Mark tightness for near-duplicates
        const nearDups = (nearDupData.clusters || []).map(
          (c: ClusterWithPhotos) => ({
            ...c,
            metadata: { ...c.metadata, tightness: 'tight' as const },
          })
        )
        allClusters.push(...nearDups)
      }

      if (scenesRes.ok) {
        const scenesData = await scenesRes.json()
        // Mark tightness for scenes
        const scenes = (scenesData.clusters || []).map(
          (c: ClusterWithPhotos) => ({
            ...c,
            metadata: { ...c.metadata, tightness: 'loose' as const },
          })
        )
        allClusters.push(...scenes)
      }

      // Sort by photo count descending
      allClusters.sort((a, b) => (b.photo_count || 0) - (a.photo_count || 0))

      setClusters(allClusters)
    } catch (error) {
      console.error('Error loading clusters:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClusters()
  }, [])

  const loadClusterDetail = async (cluster: ClusterWithPhotos) => {
    try {
      const response = await fetch(`/api/admin/photos/clusters/${cluster.id}`)
      if (response.ok) {
        const data = await response.json()
        // Preserve tightness metadata
        setSelectedCluster({
          ...data.cluster,
          metadata: {
            ...data.cluster.metadata,
            tightness: cluster.metadata?.tightness,
          },
        })
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
          setSelectedCluster(null)
          showMessage('success', 'Photo removed, cluster dissolved')
        } else {
          setSelectedCluster({
            ...data.cluster,
            metadata: {
              ...data.cluster.metadata,
              tightness: selectedCluster.metadata?.tightness,
            },
          })
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

  const handleAddPhoto = async (photoId: string) => {
    if (!selectedCluster) return

    setActionLoading(true)
    try {
      const response = await fetch(
        `/api/admin/photos/clusters/${selectedCluster.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addPhotoIds: [photoId] }),
        }
      )

      const data = await response.json()

      if (response.ok) {
        // Reload the cluster detail to get updated photos
        loadClusterDetail(selectedCluster)
        showMessage('success', 'Photo added to cluster')
        loadClusters()
      } else {
        showMessage('error', data.error || 'Failed to add photo')
      }
    } catch (_error) {
      showMessage('error', 'Failed to add photo')
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
        setSelectedCluster({
          ...data.cluster,
          metadata: {
            ...data.cluster.metadata,
            tightness: selectedCluster.metadata?.tightness,
          },
        })
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

    if (selectedCluster && selectedCluster.photos) {
      setSelectedCluster({
        ...selectedCluster,
        photos: selectedCluster.photos.map((p) =>
          p.id === photoId ? { ...p, hero_focal_point: focalPoint } : p
        ),
      })
    }
  }

  // Multi-select handlers
  const toggleSelectMode = () => {
    setSelectMode(!selectMode)
    setSelectedClusterIds(new Set())
  }

  const toggleClusterSelection = (clusterId: string) => {
    const newSelection = new Set(selectedClusterIds)
    if (newSelection.has(clusterId)) {
      newSelection.delete(clusterId)
    } else {
      newSelection.add(clusterId)
    }
    setSelectedClusterIds(newSelection)
  }

  const handleMergeClusters = async () => {
    if (selectedClusterIds.size < 2) {
      showMessage('error', 'Select at least 2 clusters to merge')
      return
    }

    if (
      !confirm(
        `Merge ${selectedClusterIds.size} clusters into one? The first selected cluster's representative will be used.`
      )
    )
      return

    setActionLoading(true)
    try {
      const clusterIds = Array.from(selectedClusterIds)
      const response = await fetch('/api/admin/photos/clusters/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clusterIds }),
      })

      const data = await response.json()

      if (response.ok) {
        showMessage(
          'success',
          `Merged ${selectedClusterIds.size} clusters into one`
        )
        setSelectedClusterIds(new Set())
        setSelectMode(false)
        loadClusters()
      } else {
        showMessage('error', data.error || 'Failed to merge clusters')
      }
    } catch (_error) {
      showMessage('error', 'Failed to merge clusters')
    } finally {
      setActionLoading(false)
    }
  }

  // Get common filters from cluster photos
  const getClusterFilters = () => {
    if (!selectedCluster?.photos || selectedCluster.photos.length === 0) {
      return { eventId: null, bandId: null }
    }

    const eventIds = new Set(
      selectedCluster.photos
        .map((p) => p.event_id)
        .filter((id): id is string => id !== null)
    )
    const bandIds = new Set(
      selectedCluster.photos
        .map((p) => p.band_id)
        .filter((id): id is string => id !== null)
    )

    return {
      eventId: eventIds.size === 1 ? Array.from(eventIds)[0] : null,
      bandId: bandIds.size === 1 ? Array.from(bandIds)[0] : null,
    }
  }

  if (loading) {
    return <div className="p-6">Loading clusters...</div>
  }

  const tightClusters = clusters.filter(
    (c) => c.metadata?.tightness === 'tight'
  )
  const looseClusters = clusters.filter(
    (c) => c.metadata?.tightness === 'loose'
  )

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

      {/* Actions bar */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSelectMode}
          className={`px-4 py-2 rounded-lg transition-colors ${
            selectMode
              ? 'bg-accent text-white'
              : 'bg-bg-elevated hover:bg-bg-hover'
          }`}
        >
          {selectMode ? 'Cancel Selection' : 'Select to Merge'}
        </button>

        {selectMode && selectedClusterIds.size > 0 && (
          <button
            onClick={handleMergeClusters}
            disabled={actionLoading || selectedClusterIds.size < 2}
            className="px-4 py-2 bg-accent hover:bg-accent-light text-white rounded-lg disabled:opacity-50"
          >
            Merge {selectedClusterIds.size} Clusters
          </button>
        )}

        <div className="text-muted text-sm">
          {clusters.length} total clusters ({tightClusters.length} tight,{' '}
          {looseClusters.length} loose)
        </div>
      </div>

      {/* Unified Cluster List */}
      <div className="bg-bg-elevated rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Photo Clusters</h2>
        <p className="text-muted mb-4 text-sm">
          <span className="inline-block w-3 h-3 bg-amber-500 rounded-full mr-1" />{' '}
          Tight (near-duplicates) &nbsp;
          <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-1" />{' '}
          Loose (similar scenes)
        </p>
        <div className="space-y-2 max-h-[32rem] overflow-y-auto">
          {clusters.map((cluster) => (
            <div
              key={cluster.id}
              className={`flex items-center gap-3 p-3 rounded transition-colors ${
                selectedCluster?.id === cluster.id
                  ? 'bg-accent/20 border border-accent'
                  : 'bg-bg hover:bg-bg-hover'
              }`}
            >
              {/* Selection checkbox */}
              {selectMode && (
                <input
                  type="checkbox"
                  checked={selectedClusterIds.has(cluster.id)}
                  onChange={() => toggleClusterSelection(cluster.id)}
                  className="w-5 h-5 rounded border-2 border-muted accent-accent cursor-pointer"
                />
              )}

              {/* Tightness indicator */}
              <div
                className={`w-3 h-3 rounded-full shrink-0 ${
                  cluster.metadata?.tightness === 'tight'
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
                }`}
                title={
                  cluster.metadata?.tightness === 'tight'
                    ? 'Near-duplicate cluster'
                    : 'Scene cluster'
                }
              />

              {/* Clickable area */}
              <button
                onClick={() => {
                  if (!selectMode) {
                    loadClusterDetail(cluster)
                  }
                }}
                disabled={selectMode}
                className="flex-1 flex items-center gap-3 text-left"
              >
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
              </button>
            </div>
          ))}
          {clusters.length === 0 && (
            <div className="text-muted text-center py-4">No clusters found</div>
          )}
        </div>
      </div>

      {/* Selected Cluster Detail */}
      {selectedCluster && selectedCluster.photos && (
        <div className="bg-bg-elevated rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 rounded-full ${
                  selectedCluster.metadata?.tightness === 'tight'
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
                }`}
              />
              <h3 className="text-lg font-semibold">
                {selectedCluster.metadata?.tightness === 'tight'
                  ? 'Tight'
                  : 'Loose'}{' '}
                Cluster ({selectedCluster.photos.length} photos)
              </h3>
            </div>
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

          {/* Cluster Photos Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
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

          {/* Nearby Photos Strip */}
          <NearbyPhotosStrip
            clusterPhotoIds={selectedCluster.photo_ids}
            clusterPhotos={selectedCluster.photos}
            eventId={getClusterFilters().eventId}
            bandId={getClusterFilters().bandId}
            onAddPhoto={handleAddPhoto}
            disabled={actionLoading}
          />
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
