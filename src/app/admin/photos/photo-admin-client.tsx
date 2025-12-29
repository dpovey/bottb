'use client'

import { useState, useCallback } from 'react'
import { Photo } from '@/lib/db-types'
import { EditIcon, CheckIcon, CloseIcon, WarningIcon } from '@/components/icons'
import { VinylSpinner } from '@/components/ui'

interface PhotoAdminClientProps {
  initialPhotos: Photo[]
  initialTotal: number
  events: { id: string; name: string }[]
  bandsMap: Record<string, { id: string; name: string }[]>
  photographers: string[]
}

export function PhotoAdminClient({
  initialPhotos,
  initialTotal,
  events,
  bandsMap,
  photographers,
}: PhotoAdminClientProps) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [total, setTotal] = useState(initialTotal)
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 50

  // Filter state
  const [filterEvent, setFilterEvent] = useState<string>('')
  const [filterBand, setFilterBand] = useState<string>('')
  const [filterPhotographer, setFilterPhotographer] = useState<string>('')
  const [filterUnmatched, setFilterUnmatched] = useState<boolean>(false)

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [bulkEventId, setBulkEventId] = useState<string>('')
  const [bulkBandId, setBulkBandId] = useState<string>('')
  const [bulkPhotographer, setBulkPhotographer] = useState<string>('')
  const [isBulkSaving, setIsBulkSaving] = useState(false)

  // Fetch photos with current filters
  const fetchPhotos = useCallback(
    async (pageNum: number) => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', pageNum.toString())
        params.set('limit', pageSize.toString())
        params.set('order', 'uploaded')

        if (filterEvent) params.set('event', filterEvent)
        if (filterBand) params.set('band', filterBand)
        if (filterPhotographer) params.set('photographer', filterPhotographer)
        if (filterUnmatched) params.set('unmatched', 'true')

        const res = await fetch(`/api/photos?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setPhotos(data.photos)
          setTotal(data.pagination.total)
        }
      } catch (error) {
        console.error('Failed to fetch photos:', error)
      } finally {
        setIsLoading(false)
      }
    },
    [filterEvent, filterBand, filterPhotographer, filterUnmatched]
  )

  // Apply filters
  const handleApplyFilters = () => {
    setPage(1)
    setSelectedIds(new Set())
    fetchPhotos(1)
  }

  // Clear filters
  const handleClearFilters = () => {
    setFilterEvent('')
    setFilterBand('')
    setFilterPhotographer('')
    setFilterUnmatched(false)
    setPage(1)
    setSelectedIds(new Set())
    fetchPhotos(1)
  }

  // Pagination
  const handleNextPage = () => {
    const newPage = page + 1
    setPage(newPage)
    fetchPhotos(newPage)
  }

  const handlePrevPage = () => {
    const newPage = Math.max(1, page - 1)
    setPage(newPage)
    fetchPhotos(newPage)
  }

  // Selection
  const toggleSelect = (photoId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(photoId)) {
        newSet.delete(photoId)
      } else {
        newSet.add(photoId)
      }
      return newSet
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(photos.map((p) => p.id)))
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  // Bulk update
  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return

    setIsBulkSaving(true)
    try {
      // Update each selected photo
      const updatePromises = Array.from(selectedIds).map((photoId) =>
        fetch(`/api/photos/${photoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(bulkEventId && { event_id: bulkEventId }),
            ...(bulkBandId && { band_id: bulkBandId }),
            ...(bulkPhotographer && { photographer: bulkPhotographer }),
          }),
        })
      )

      await Promise.all(updatePromises)

      // Refresh photos
      await fetchPhotos(page)
      clearSelection()
      setBulkEditMode(false)
      setBulkEventId('')
      setBulkBandId('')
      setBulkPhotographer('')
    } catch (error) {
      console.error('Bulk update failed:', error)
    } finally {
      setIsBulkSaving(false)
    }
  }

  // Count unmatched (no event or no band)
  const unmatchedCount = photos.filter((p) => !p.event_id || !p.band_id).length

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-elevated rounded-xl p-4 border border-white/5">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Event Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Event
            </label>
            <select
              value={filterEvent}
              onChange={(e) => {
                setFilterEvent(e.target.value)
                setFilterBand('')
              }}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white text-sm"
            >
              <option value="">All Events</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>

          {/* Band Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Band
            </label>
            <select
              value={filterBand}
              onChange={(e) => setFilterBand(e.target.value)}
              disabled={!filterEvent}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white text-sm disabled:opacity-50"
            >
              <option value="">All Bands</option>
              {filterEvent &&
                bandsMap[filterEvent]?.map((band) => (
                  <option key={band.id} value={band.id}>
                    {band.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Photographer Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Photographer
            </label>
            <select
              value={filterPhotographer}
              onChange={(e) => setFilterPhotographer(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white text-sm"
            >
              <option value="">All Photographers</option>
              {photographers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Unmatched Filter */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterUnmatched}
                onChange={(e) => setFilterUnmatched(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-accent focus:ring-accent"
              />
              <span className="text-sm text-gray-300">
                Unmatched only
                {unmatchedCount > 0 && (
                  <span className="ml-1 text-warning">({unmatchedCount})</span>
                )}
              </span>
            </label>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleApplyFilters}
              className="px-4 py-2 bg-accent hover:bg-accent-light text-white text-sm rounded-lg transition-colors"
            >
              Apply
            </button>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-accent/20 border border-accent/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-accent font-medium">
              {selectedIds.size} photo{selectedIds.size !== 1 ? 's' : ''}{' '}
              selected
            </span>
            <button
              onClick={clearSelection}
              className="text-sm text-gray-300 hover:text-white"
            >
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-3">
            {!bulkEditMode ? (
              <button
                onClick={() => setBulkEditMode(true)}
                className="px-4 py-2 bg-accent hover:bg-accent-light text-white text-sm rounded-lg transition-colors flex items-center gap-2"
              >
                <EditIcon size={16} />
                Bulk Edit
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <select
                  value={bulkEventId}
                  onChange={(e) => {
                    setBulkEventId(e.target.value)
                    setBulkBandId('')
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm"
                >
                  <option value="">Set Event...</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
                <select
                  value={bulkBandId}
                  onChange={(e) => setBulkBandId(e.target.value)}
                  disabled={!bulkEventId}
                  className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm disabled:opacity-50"
                >
                  <option value="">Set Band...</option>
                  {bulkEventId &&
                    bandsMap[bulkEventId]?.map((band) => (
                      <option key={band.id} value={band.id}>
                        {band.name}
                      </option>
                    ))}
                </select>
                <input
                  type="text"
                  placeholder="Set Photographer..."
                  value={bulkPhotographer}
                  onChange={(e) => setBulkPhotographer(e.target.value)}
                  list="bulk-photographer-list"
                  className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-gray-500 w-40"
                />
                <datalist id="bulk-photographer-list">
                  {photographers.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                <button
                  onClick={handleBulkUpdate}
                  disabled={
                    isBulkSaving ||
                    (!bulkEventId && !bulkBandId && !bulkPhotographer)
                  }
                  className="px-4 py-1.5 bg-success hover:bg-success-light text-white text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isBulkSaving ? (
                    <VinylSpinner size="xxs" />
                  ) : (
                    <CheckIcon size={16} />
                  )}
                  Apply
                </button>
                <button
                  onClick={() => {
                    setBulkEditMode(false)
                    setBulkEventId('')
                    setBulkBandId('')
                    setBulkPhotographer('')
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photos Table */}
      <div className="bg-elevated rounded-xl border border-white/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-white">
              Photos ({total})
            </h2>
            <button
              onClick={selectAll}
              className="text-sm text-gray-400 hover:text-white"
            >
              Select all on page
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>
              Page {page} of {Math.ceil(total / pageSize)}
            </span>
            <button
              onClick={handlePrevPage}
              disabled={page <= 1 || isLoading}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={handleNextPage}
              disabled={page >= Math.ceil(total / pageSize) || isLoading}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <VinylSpinner size="sm" />
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No photos found matching your filters
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size === photos.length && photos.length > 0
                      }
                      onChange={(e) =>
                        e.target.checked ? selectAll() : clearSelection()
                      }
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-accent focus:ring-accent"
                    />
                  </th>
                  <th className="px-4 py-3 w-16">Preview</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Band</th>
                  <th className="px-4 py-3">Photographer</th>
                  <th className="px-4 py-3 w-24">Match</th>
                  <th className="px-4 py-3 w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {photos.map((photo) => (
                  <PhotoRow
                    key={photo.id}
                    photo={photo}
                    isSelected={selectedIds.has(photo.id)}
                    onToggleSelect={() => toggleSelect(photo.id)}
                    events={events}
                    bandsMap={bandsMap}
                    photographers={photographers}
                    onUpdate={() => fetchPhotos(page)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// Individual photo row component
interface PhotoRowProps {
  photo: Photo
  isSelected: boolean
  onToggleSelect: () => void
  events: { id: string; name: string }[]
  bandsMap: Record<string, { id: string; name: string }[]>
  photographers: string[]
  onUpdate: () => void
}

function PhotoRow({
  photo,
  isSelected,
  onToggleSelect,
  events,
  bandsMap,
  photographers,
  onUpdate,
}: PhotoRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editEventId, setEditEventId] = useState(photo.event_id || '')
  const [editBandId, setEditBandId] = useState(photo.band_id || '')
  const [editPhotographer, setEditPhotographer] = useState(
    photo.photographer || ''
  )
  const [isSaving, setIsSaving] = useState(false)

  const hasIssue = !photo.event_id || !photo.band_id

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/photos/${photo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: editEventId || null,
          band_id: editBandId || null,
          photographer: editPhotographer || null,
        }),
      })

      if (response.ok) {
        setIsEditing(false)
        onUpdate()
      }
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditEventId(photo.event_id || '')
    setEditBandId(photo.band_id || '')
    setEditPhotographer(photo.photographer || '')
  }

  return (
    <tr
      className={`border-b border-white/5 hover:bg-white/5 ${
        hasIssue ? 'bg-warning/5' : ''
      }`}
    >
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="w-4 h-4 rounded border-white/20 bg-white/5 text-accent focus:ring-accent"
        />
      </td>
      <td className="px-4 py-3">
        <a
          href={`/photos?photo=${photo.id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.thumbnail_url || photo.blob_url}
            alt={photo.original_filename || 'Photo'}
            className="w-12 h-12 object-cover rounded-lg hover:opacity-80 transition-opacity"
          />
        </a>
      </td>
      <td className="px-4 py-3">
        {isEditing ? (
          <select
            value={editEventId}
            onChange={(e) => {
              setEditEventId(e.target.value)
              setEditBandId('')
            }}
            className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-sm"
          >
            <option value="">None</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        ) : (
          <span className={!photo.event_name ? 'text-warning' : 'text-white'}>
            {photo.event_name || (
              <span className="flex items-center gap-1">
                <WarningIcon size={14} />
                None
              </span>
            )}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {isEditing ? (
          <select
            value={editBandId}
            onChange={(e) => setEditBandId(e.target.value)}
            disabled={!editEventId}
            className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-sm disabled:opacity-50"
          >
            <option value="">None</option>
            {editEventId &&
              bandsMap[editEventId]?.map((band) => (
                <option key={band.id} value={band.id}>
                  {band.name}
                </option>
              ))}
          </select>
        ) : (
          <span className={!photo.band_name ? 'text-warning' : 'text-white'}>
            {photo.band_name || (
              <span className="flex items-center gap-1">
                <WarningIcon size={14} />
                None
              </span>
            )}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {isEditing ? (
          <input
            type="text"
            value={editPhotographer}
            onChange={(e) => setEditPhotographer(e.target.value)}
            list={`photographer-list-${photo.id}`}
            className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-sm"
            placeholder="None"
          />
        ) : (
          <span className="text-gray-300">
            {photo.photographer || <span className="text-gray-500">None</span>}
          </span>
        )}
        <datalist id={`photographer-list-${photo.id}`}>
          {photographers.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </td>
      <td className="px-4 py-3">
        <span
          className={`text-xs px-2 py-1 rounded ${
            photo.match_confidence === 'exact'
              ? 'bg-success/20 text-success'
              : photo.match_confidence === 'manual'
                ? 'bg-accent/20 text-accent'
                : photo.match_confidence === 'fuzzy'
                  ? 'bg-warning/20 text-warning'
                  : 'bg-error/20 text-error'
          }`}
        >
          {photo.match_confidence || 'unmatched'}
        </span>
      </td>
      <td className="px-4 py-3">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="p-1.5 bg-success/20 hover:bg-success/30 text-success rounded transition-colors disabled:opacity-50"
              title="Save"
            >
              {isSaving ? <VinylSpinner size="xxs" /> : <CheckIcon size={16} />}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
              title="Cancel"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded transition-colors"
            title="Edit"
          >
            <EditIcon size={16} />
          </button>
        )}
      </td>
    </tr>
  )
}
