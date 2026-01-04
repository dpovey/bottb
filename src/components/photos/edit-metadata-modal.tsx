'use client'

import { useState, useEffect, useCallback } from 'react'
import { Photo } from '@/lib/db-types'
import { Modal, VinylSpinner } from '@/components/ui'

interface EditMetadataModalProps {
  isOpen: boolean
  photo: Photo
  onClose: () => void
  onPhotoUpdated: (photo: Photo) => void
}

/**
 * Modal for editing photo metadata (event, band, photographer).
 * Handles fetching options and saving changes via API.
 */
export function EditMetadataModal({
  isOpen,
  photo,
  onClose,
  onPhotoUpdated,
}: EditMetadataModalProps) {
  // Options state
  const [events, setEvents] = useState<{ id: string; name: string }[]>([])
  const [bandsMap, setBandsMap] = useState<
    Record<string, { id: string; name: string }[]>
  >({})
  const [photographers, setPhotographers] = useState<string[]>([])

  // Edit state (initialized from photo)
  const [editEventId, setEditEventId] = useState<string | null>(photo.event_id)
  const [editBandId, setEditBandId] = useState<string | null>(photo.band_id)
  const [editPhotographer, setEditPhotographer] = useState<string | null>(
    photo.photographer
  )

  // Loading/error state
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset edit state when photo changes
  useEffect(() => {
    setEditEventId(photo.event_id)
    setEditBandId(photo.band_id)
    setEditPhotographer(photo.photographer)
  }, [photo])

  // Fetch options when modal opens
  const fetchOptions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Fetch events
      const eventsRes = await fetch('/api/events')
      if (!eventsRes.ok) throw new Error('Failed to fetch events')
      const eventsData = await eventsRes.json()
      setEvents(
        Array.isArray(eventsData)
          ? eventsData.map((e: { id: string; name: string }) => ({
              id: e.id,
              name: e.name,
            }))
          : []
      )

      // Fetch bands for each event
      const newBandsMap: Record<string, { id: string; name: string }[]> = {}
      for (const event of eventsData) {
        const bandsRes = await fetch(`/api/events/${event.id}/bands`)
        if (bandsRes.ok) {
          const bands = await bandsRes.json()
          newBandsMap[event.id] = Array.isArray(bands)
            ? bands.map((b: { id: string; name: string }) => ({
                id: b.id,
                name: b.name,
              }))
            : []
        }
      }
      setBandsMap(newBandsMap)

      // Fetch distinct photographers
      const photographersRes = await fetch('/api/photographers/names')
      if (photographersRes.ok) {
        const data = await photographersRes.json()
        setPhotographers(data.photographers || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load options')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch options when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchOptions()
    }
  }, [isOpen, fetchOptions])

  // Save metadata
  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/photos/${photo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: editEventId,
          band_id: editBandId,
          photographer: editPhotographer,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update photo')
      }

      const result = await response.json()
      onPhotoUpdated(result.photo)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setError(null)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Photo Metadata"
      description="Update event, band, or photographer associations"
      size="md"
      disabled={isSaving}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <VinylSpinner size="xs" className="text-accent" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Event Selector */}
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              Event
            </label>
            <select
              value={editEventId || ''}
              onChange={(e) => {
                const newEventId = e.target.value || null
                setEditEventId(newEventId)
                // Clear band when event changes
                setEditBandId(null)
              }}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:border-accent focus:outline-hidden"
            >
              <option value="">No Event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>

          {/* Band Selector (depends on event) */}
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              Band
            </label>
            <select
              value={editBandId || ''}
              onChange={(e) => setEditBandId(e.target.value || null)}
              disabled={!editEventId}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:border-accent focus:outline-hidden disabled:opacity-50"
            >
              <option value="">No Band</option>
              {editEventId &&
                bandsMap[editEventId]?.map((band) => (
                  <option key={band.id} value={band.id}>
                    {band.name}
                  </option>
                ))}
            </select>
            {!editEventId && (
              <p className="text-xs text-text-dim mt-1">
                Select an event first to choose a band
              </p>
            )}
          </div>

          {/* Photographer Selector/Input */}
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              Photographer
            </label>
            <input
              type="text"
              list="photographer-list"
              value={editPhotographer || ''}
              onChange={(e) => setEditPhotographer(e.target.value || null)}
              placeholder="Enter photographer name"
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden"
            />
            <datalist id="photographer-list">
              {photographers.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          {/* Current values info */}
          <div className="pt-4 border-t border-white/10">
            <p className="text-xs text-text-dim mb-2">Current values:</p>
            <div className="text-xs text-text-muted space-y-1">
              <p>
                Event:{' '}
                <span className="text-white">{photo.event_name || 'None'}</span>
              </p>
              <p>
                Band:{' '}
                <span className="text-white">{photo.band_name || 'None'}</span>
              </p>
              <p>
                Photographer:{' '}
                <span className="text-white">
                  {photo.photographer || 'None'}
                </span>
              </p>
              <p>
                Match confidence:{' '}
                <span className="text-white">
                  {photo.match_confidence || 'unmatched'}
                </span>
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button
              onClick={handleClose}
              disabled={isSaving}
              className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-accent hover:bg-accent-light px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <VinylSpinner size="xxs" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
