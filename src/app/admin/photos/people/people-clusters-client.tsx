'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { PhotoCluster, Photo } from '@/lib/db-types'
import {
  FilterBar,
  FilterSelect,
  FilterSearch,
  FilterClearButton,
  Button,
} from '@/components/ui'
import {
  CheckIcon,
  CloseIcon,
  UsersIcon,
  DeleteIcon,
  MergeIcon,
} from '@/components/icons'

/**
 * Component to display a cropped face from a photo using CSS object-fit/position
 */
function FaceCropThumbnail({
  imageUrl,
  box,
  alt,
}: {
  imageUrl: string
  box: { x: number; y: number; width: number; height: number }
  alt: string
}) {
  // Calculate the scale and position to show the face centered
  // box coordinates are normalized (0-1)
  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2

  // Add padding around the face (20% on each side)
  const padding = 0.2
  const viewWidth = Math.min(1, box.width * (1 + padding * 2))
  const viewHeight = Math.min(1, box.height * (1 + padding * 2))

  // Scale to fill the container while keeping the face visible
  const scale = 1 / Math.max(viewWidth, viewHeight)

  // Position to center the face
  const posX = (0.5 - centerX) * scale * 100 + 50
  const posY = (0.5 - centerY) * scale * 100 + 50

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={alt}
      className="w-full h-full transition-transform duration-200 group-hover:scale-105"
      style={{
        objectFit: 'cover',
        objectPosition: `${posX}% ${posY}%`,
        transform: `scale(${scale})`,
        transformOrigin: 'center',
      }}
    />
  )
}

interface ClusterWithPhoto extends PhotoCluster {
  photo_count?: number
  representative_photo?: {
    id: string
    original_filename: string | null
    blob_url: string
    thumbnail_url: string | null
    event_id?: string | null
  } | null
  representative_face?: {
    filename: string
    box: { x: number; y: number; width: number; height: number }
    quality_score: number
  } | null
  // Enriched event info
  event_ids?: string[]
}

interface EventOption {
  id: string
  name: string
}

interface PeopleClustersClientProps {
  events: EventOption[]
}

export function PeopleClustersClient({ events }: PeopleClustersClientProps) {
  const [clusters, setClusters] = useState<ClusterWithPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCluster, setSelectedCluster] =
    useState<ClusterWithPhoto | null>(null)
  const [clusterPhotos, setClusterPhotos] = useState<Photo[]>([])
  const [actionLoading, setActionLoading] = useState(false)

  // Filter state
  const [filterEvent, setFilterEvent] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false)
  const [selectedClusterIds, setSelectedClusterIds] = useState<Set<string>>(
    new Set()
  )

  // Toast message state
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const loadClusters = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    loadClusters()
  }, [loadClusters])

  // Filter clusters based on event and search
  const filteredClusters = useMemo(() => {
    let result = clusters

    // Filter by event - check if any photo in cluster belongs to event
    if (filterEvent) {
      result = result.filter((cluster) => {
        // Check representative photo's event
        if (cluster.representative_photo?.event_id === filterEvent) {
          return true
        }
        // Check event_ids array if available
        if (cluster.event_ids?.includes(filterEvent)) {
          return true
        }
        return false
      })
    }

    // Filter by search (person ID)
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter((cluster) => {
        const personId =
          (cluster.metadata as { person_id?: number })?.person_id ?? 0
        return (
          personId.toString().includes(query) ||
          `person ${personId}`.toLowerCase().includes(query)
        )
      })
    }

    return result
  }, [clusters, filterEvent, searchQuery])

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

  // Multi-select handlers
  const toggleSelectMode = () => {
    setSelectMode(!selectMode)
    setSelectedClusterIds(new Set())
    setSelectedCluster(null)
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

  const selectAllVisible = () => {
    setSelectedClusterIds(new Set(filteredClusters.map((c) => c.id)))
  }

  const clearSelection = () => {
    setSelectedClusterIds(new Set())
  }

  // Merge clusters
  const handleMergeClusters = async () => {
    if (selectedClusterIds.size < 2) {
      showMessage('error', 'Select at least 2 clusters to merge')
      return
    }

    if (
      !confirm(
        `Merge ${selectedClusterIds.size} person clusters into one? Photos will be combined.`
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

  // Explode cluster (delete cluster, photos remain ungrouped)
  const handleExplodeCluster = async (cluster: ClusterWithPhoto) => {
    if (
      !confirm(
        `Explode this cluster? The ${cluster.photo_count || cluster.photo_ids.length} photos will become ungrouped.`
      )
    )
      return

    setActionLoading(true)
    try {
      const response = await fetch(`/api/admin/photos/clusters/${cluster.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        showMessage('success', 'Cluster exploded - photos are now ungrouped')
        if (selectedCluster?.id === cluster.id) {
          setSelectedCluster(null)
          setClusterPhotos([])
        }
        loadClusters()
      } else {
        const data = await response.json()
        showMessage('error', data.error || 'Failed to explode cluster')
      }
    } catch (_error) {
      showMessage('error', 'Failed to explode cluster')
    } finally {
      setActionLoading(false)
    }
  }

  // Clear filters
  const handleClearFilters = () => {
    setFilterEvent('')
    setSearchQuery('')
  }

  const hasActiveFilters = filterEvent !== '' || searchQuery !== ''

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-pulse text-text-muted">
          Loading people clusters...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Toast message */}
      {message && (
        <div
          className={`fixed top-4 right-4 px-4 py-3 rounded-lg z-50 shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
            message.type === 'success'
              ? 'bg-success/20 text-success border border-success/30'
              : 'bg-error/20 text-error border border-error/30'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Filter Bar */}
      <FilterBar>
        <FilterSearch
          label="Search"
          placeholder="Search by person ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery('')}
        />

        <FilterSelect
          label="Event"
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value)}
        >
          <option value="">All Events</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </FilterSelect>

        <FilterClearButton
          disabled={!hasActiveFilters}
          onClick={handleClearFilters}
        />
      </FilterBar>

      {/* Actions Bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button
          variant={selectMode ? 'accent' : 'outline-solid'}
          size="sm"
          onClick={toggleSelectMode}
        >
          {selectMode ? (
            <>
              <CloseIcon size={16} />
              Cancel Selection
            </>
          ) : (
            <>
              <CheckIcon size={16} />
              Select to Merge
            </>
          )}
        </Button>

        {selectMode && (
          <>
            <Button variant="ghost" size="sm" onClick={selectAllVisible}>
              Select All ({filteredClusters.length})
            </Button>
            {selectedClusterIds.size > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear ({selectedClusterIds.size})
                </Button>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={handleMergeClusters}
                  disabled={actionLoading || selectedClusterIds.size < 2}
                >
                  <MergeIcon size={16} />
                  Merge {selectedClusterIds.size} Clusters
                </Button>
              </>
            )}
          </>
        )}

        <div className="ml-auto text-sm text-text-muted">
          {filteredClusters.length} of {clusters.length} people
          {hasActiveFilters && ' (filtered)'}
        </div>
      </div>

      {/* Clusters Grid */}
      {filteredClusters.length === 0 ? (
        <div className="bg-bg-elevated rounded-xl p-12 text-center">
          <UsersIcon size={48} className="mx-auto mb-4 text-text-dim" />
          <p className="text-text-muted">
            {hasActiveFilters
              ? 'No people match the current filters.'
              : 'No people clusters found. Run face detection to identify people in photos.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredClusters.map((cluster) => {
            const personId =
              (cluster.metadata as { person_id?: number })?.person_id ?? 0
            const isSelected = selectedClusterIds.has(cluster.id)
            const isViewing = selectedCluster?.id === cluster.id

            return (
              <div
                key={cluster.id}
                className={`
                  group relative rounded-xl overflow-hidden
                  bg-bg-elevated border transition-all duration-200
                  ${isSelected ? 'border-accent ring-2 ring-accent/30' : 'border-white/5'}
                  ${isViewing ? 'border-accent' : ''}
                  ${!selectMode ? 'hover:border-white/20 hover:scale-[1.02]' : ''}
                  cursor-pointer
                `}
                onClick={() => {
                  if (selectMode) {
                    toggleClusterSelection(cluster.id)
                  } else {
                    loadClusterPhotos(cluster)
                  }
                }}
              >
                {/* Thumbnail - show face crop if available, otherwise full photo */}
                <div className="aspect-square relative bg-bg overflow-hidden">
                  {cluster.representative_photo?.thumbnail_url ||
                  cluster.representative_photo?.blob_url ? (
                    cluster.representative_face?.box ? (
                      // Show cropped face using object-position
                      <FaceCropThumbnail
                        imageUrl={
                          cluster.representative_photo.blob_url ||
                          cluster.representative_photo.thumbnail_url!
                        }
                        box={cluster.representative_face.box}
                        alt={`Person ${personId}`}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={
                          cluster.representative_photo.thumbnail_url ||
                          cluster.representative_photo.blob_url
                        }
                        alt={`Person ${personId}`}
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <UsersIcon size={32} className="text-text-dim" />
                    </div>
                  )}

                  {/* Selection checkbox overlay */}
                  {selectMode && (
                    <div
                      className={`absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-accent border-accent'
                          : 'bg-bg/80 border-white/30 group-hover:border-white/50'
                      }`}
                    >
                      {isSelected && (
                        <CheckIcon size={14} className="text-bg" />
                      )}
                    </div>
                  )}

                  {/* Photo count badge */}
                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-bg/80 backdrop-blur-sm rounded-md text-xs font-medium">
                    {cluster.photo_count || cluster.photo_ids.length} photos
                  </div>

                  {/* Quality score badge */}
                  {cluster.representative_face?.quality_score && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-bg/80 backdrop-blur-sm rounded-md text-xs text-text-muted">
                      Q: {cluster.representative_face.quality_score.toFixed(1)}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="font-medium text-sm">Person {personId}</div>
                  <div className="text-xs text-text-muted mt-1">
                    {new Date(cluster.created_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Quick actions on hover (only when not in select mode) */}
                {!selectMode && (
                  <div className="absolute inset-0 bg-gradient-to-t from-bg/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-14 gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleExplodeCluster(cluster)
                      }}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-error/20 hover:bg-error/30 text-error text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Explode cluster (ungroup photos)"
                    >
                      <DeleteIcon size={14} className="inline mr-1" />
                      Explode
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Selected Cluster Detail Panel */}
      {selectedCluster && !selectMode && (
        <div className="bg-bg-elevated rounded-xl border border-white/5 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <UsersIcon size={20} className="text-accent" />
              <h3 className="font-semibold">
                Person{' '}
                {(selectedCluster.metadata as { person_id?: number })
                  ?.person_id ?? '?'}
              </h3>
              <span className="text-sm text-text-muted">
                {clusterPhotos.length} photos
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleExplodeCluster(selectedCluster)}
                disabled={actionLoading}
                className="text-error hover:bg-error/10"
              >
                <DeleteIcon size={16} />
                Explode
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedCluster(null)
                  setClusterPhotos([])
                }}
              >
                <CloseIcon size={16} />
                Close
              </Button>
            </div>
          </div>

          {/* Photos grid */}
          <div className="p-4">
            {clusterPhotos.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {clusterPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="aspect-square rounded-lg overflow-hidden bg-bg group cursor-pointer hover:ring-2 hover:ring-accent/50 transition-all"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbnail_url || photo.blob_url}
                      alt={photo.original_filename || 'Photo'}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-text-muted">
                Loading photos...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
