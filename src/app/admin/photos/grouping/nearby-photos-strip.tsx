'use client'

import { useState, useEffect, useRef } from 'react'
import { PlusIcon } from '@/components/icons'

interface NearbyPhoto {
  id: string
  blob_url: string
  thumbnail_url: string | null
  original_filename: string | null
  captured_at: string | null
}

interface ClusterPhoto {
  id: string
  captured_at: string | null
}

interface NearbyPhotosStripProps {
  /** Photo IDs currently in the cluster */
  clusterPhotoIds: string[]
  /** Photos with captured_at for finding temporal neighbors */
  clusterPhotos: ClusterPhoto[]
  /** Filter to same event if all cluster photos share one */
  eventId: string | null
  /** Filter to same band if all cluster photos share one */
  bandId: string | null
  /** Callback when user wants to add a photo to the cluster */
  onAddPhoto: (photoId: string) => void
  /** Whether actions are disabled */
  disabled?: boolean
}

export function NearbyPhotosStrip({
  clusterPhotoIds,
  clusterPhotos,
  eventId,
  bandId,
  onAddPhoto,
  disabled = false,
}: NearbyPhotosStripProps) {
  const [nearbyPhotos, setNearbyPhotos] = useState<NearbyPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const stripRef = useRef<HTMLDivElement>(null)

  // Find the capture time range of cluster photos
  function getTimeRange() {
    const times = clusterPhotos
      .map((p) => p.captured_at)
      .filter((t): t is string => t !== null)
      .map((t) => new Date(t).getTime())

    if (times.length === 0) return null

    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)

    return {
      // Expand range by 5 minutes on each side
      startTime: new Date(minTime - 5 * 60 * 1000).toISOString(),
      endTime: new Date(maxTime + 5 * 60 * 1000).toISOString(),
      centerTime: new Date((minTime + maxTime) / 2).toISOString(),
    }
  }

  async function loadNearbyPhotos() {
    const timeRange = getTimeRange()
    if (!timeRange) {
      setNearbyPhotos([])
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({
        startTime: timeRange.startTime,
        endTime: timeRange.endTime,
        excludeIds: clusterPhotoIds.join(','),
        limit: '50',
      })

      if (eventId) params.set('eventId', eventId)
      if (bandId) params.set('bandId', bandId)

      const response = await fetch(
        `/api/admin/photos/clusters/nearby?${params.toString()}`
      )

      if (response.ok) {
        const data = await response.json()
        setNearbyPhotos(data.photos || [])
      }
    } catch (error) {
      console.error('Error loading nearby photos:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNearbyPhotos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterPhotoIds.join(','), eventId, bandId])

  // Don't render if we have no time data
  const timeRange = getTimeRange()
  if (!timeRange) {
    return (
      <div className="border-t border-border pt-4 mt-4">
        <h4 className="text-sm font-medium text-muted mb-2">Nearby Photos</h4>
        <p className="text-sm text-muted">
          No capture time data available for this cluster
        </p>
      </div>
    )
  }

  return (
    <div className="border-t border-border pt-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium">Nearby Photos (±5 min)</h4>
        {eventId && bandId && (
          <span className="text-xs text-muted">
            Filtered to same event & band
          </span>
        )}
        {eventId && !bandId && (
          <span className="text-xs text-muted">Filtered to same event</span>
        )}
      </div>

      {loading && (
        <div className="text-sm text-muted py-4">Loading nearby photos...</div>
      )}

      {!loading && nearbyPhotos.length === 0 && (
        <div className="text-sm text-muted py-4">
          No nearby photos found (within ±5 minutes)
        </div>
      )}

      {!loading && nearbyPhotos.length > 0 && (
        <div
          ref={stripRef}
          className="flex gap-3 overflow-x-auto py-2 px-1 scrollbar-thin scrollbar-track-bg scrollbar-thumb-muted"
          style={{ scrollbarWidth: 'thin' }}
        >
          {nearbyPhotos.map((photo) => (
            <div
              key={photo.id}
              className="relative shrink-0 w-24 h-24 rounded-lg overflow-hidden group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbnail_url || photo.blob_url}
                alt={photo.original_filename || 'Photo'}
                className="w-full h-full object-cover"
              />

              {/* Time indicator */}
              {photo.captured_at && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-1 py-0.5 text-center">
                  {new Date(photo.captured_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </div>
              )}

              {/* Add button overlay */}
              <button
                onClick={() => onAddPhoto(photo.id)}
                disabled={disabled}
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center disabled:cursor-not-allowed"
                title="Add to cluster"
              >
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                  <PlusIcon className="w-6 h-6 text-white" />
                </div>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
