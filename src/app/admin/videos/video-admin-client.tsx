'use client'

import { useState } from 'react'
import { Video } from '@/lib/db'
import { EditIcon, DeleteIcon, CloseIcon, PlusIcon } from '@/components/icons'
import { ConfirmModal, Button, Card } from '@/components/ui'

interface VideoAdminClientProps {
  initialVideos: Video[]
  events: { id: string; name: string }[]
  bandsMap: Record<string, { id: string; name: string }[]>
}

export function VideoAdminClient({
  initialVideos,
  events,
  bandsMap,
}: VideoAdminClientProps) {
  const [videos, setVideos] = useState<Video[]>(initialVideos)
  const [isAddingVideo, setIsAddingVideo] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [title, setTitle] = useState('')
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedBandId, setSelectedBandId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<Video | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Get bands for selected event
  const availableBands = selectedEventId ? bandsMap[selectedEventId] || [] : []

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeUrl,
          title,
          eventId: selectedEventId || null,
          bandId: selectedBandId || null,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setVideos([data.video, ...videos])
        setYoutubeUrl('')
        setTitle('')
        setSelectedEventId('')
        setSelectedBandId('')
        setIsAddingVideo(false)
      } else if (response.status === 409) {
        const data = await response.json()
        setError(`Video already exists: ${data.video?.title || 'Unknown'}`)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to add video')
      }
    } catch (err) {
      setError('Failed to add video')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setOperationError(null)

    try {
      const response = await fetch(`/api/videos/${deleteTarget.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setVideos(videos.filter((v) => v.id !== deleteTarget.id))
        setDeleteTarget(null)
      } else {
        const data = await response.json()
        setOperationError(data.error || 'Failed to delete video')
      }
    } catch (err) {
      setOperationError('Failed to delete video')
      console.error(err)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleUpdateVideo = async (
    videoId: string,
    title: string | null,
    eventId: string | null,
    bandId: string | null
  ) => {
    setOperationError(null)
    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, eventId, bandId }),
      })

      if (response.ok) {
        const data = await response.json()
        setVideos(
          videos.map((v) => (v.id === videoId ? { ...v, ...data.video } : v))
        )
      } else {
        const data = await response.json()
        setOperationError(data.error || 'Failed to update video')
      }
    } catch (err) {
      setOperationError('Failed to update video')
      console.error(err)
    }
  }

  return (
    <div className="space-y-8">
      {/* Operation Error Banner */}
      {operationError && (
        <div className="bg-error/20 border border-error/50 text-error px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{operationError}</span>
          <button
            onClick={() => setOperationError(null)}
            className="text-error hover:text-white cursor-pointer"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      {/* Add Video Button */}
      <div className="flex justify-end">
        <Button variant="accent" onClick={() => setIsAddingVideo(true)}>
          <PlusIcon size={20} />
          Add Video
        </Button>
      </div>

      {/* Add Video Form */}
      {isAddingVideo && (
        <Card>
          <h2 className="text-xl font-bold text-white mb-4">Add New Video</h2>
          <form onSubmit={handleAddVideo} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                YouTube URL or Video ID *
              </label>
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or VIDEO_ID"
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Video title"
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Event (optional)
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => {
                    setSelectedEventId(e.target.value)
                    setSelectedBandId('') // Reset band when event changes
                  }}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:border-accent focus:outline-hidden"
                >
                  <option value="">Select Event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Band (optional)
                </label>
                <select
                  value={selectedBandId}
                  onChange={(e) => setSelectedBandId(e.target.value)}
                  disabled={!selectedEventId}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:border-accent focus:outline-hidden disabled:opacity-50"
                >
                  <option value="">Select Band</option>
                  {availableBands.map((band) => (
                    <option key={band.id} value={band.id}>
                      {band.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="bg-error/20 border border-error/50 text-error px-4 py-2 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button type="submit" variant="accent" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Video'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsAddingVideo(false)
                  setError(null)
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Videos List */}
      <Card>
        <h2 className="text-2xl font-bold text-white mb-6">
          Videos ({videos.length})
        </h2>

        {videos.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-300 text-lg">No videos found</p>
            <p className="text-gray-400 text-sm mt-2">
              Add your first video to get started
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {videos.map((video) => (
              <VideoRow
                key={video.id}
                video={video}
                events={events}
                bandsMap={bandsMap}
                onUpdate={handleUpdateVideo}
                onRequestDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Video"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
        variant="danger"
      />
    </div>
  )
}

interface VideoRowProps {
  video: Video
  events: { id: string; name: string }[]
  bandsMap: Record<string, { id: string; name: string }[]>
  onUpdate: (
    videoId: string,
    title: string | null,
    eventId: string | null,
    bandId: string | null
  ) => Promise<void>
  onRequestDelete: (video: Video) => void
}

function VideoRow({
  video,
  events,
  bandsMap,
  onUpdate,
  onRequestDelete,
}: VideoRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(video.title)
  const [editEventId, setEditEventId] = useState(video.event_id || '')
  const [editBandId, setEditBandId] = useState(video.band_id || '')

  const availableBands = editEventId ? bandsMap[editEventId] || [] : []

  const handleSave = async () => {
    await onUpdate(video.id, editTitle, editEventId || null, editBandId || null)
    setIsEditing(false)
  }

  return (
    <div className="bg-surface rounded-xl p-4 flex gap-4">
      {/* Thumbnail */}
      <a
        href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            video.thumbnail_url ||
            `https://img.youtube.com/vi/${video.youtube_video_id}/mqdefault.jpg`
          }
          alt={video.title}
          className="w-32 h-20 object-cover rounded-lg hover:opacity-80 transition-opacity"
        />
      </a>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="space-y-3">
            {/* Title input */}
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Video title"
              className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-white text-sm focus:border-accent focus:outline-hidden"
            />
            <p className="text-sm text-gray-400">{video.youtube_video_id}</p>

            <div className="flex gap-3 items-center flex-wrap">
              <select
                value={editEventId}
                onChange={(e) => {
                  setEditEventId(e.target.value)
                  setEditBandId('')
                }}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-white text-sm"
              >
                <option value="">No Event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>

              <select
                value={editBandId}
                onChange={(e) => setEditBandId(e.target.value)}
                disabled={!editEventId}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-white text-sm disabled:opacity-50"
              >
                <option value="">No Band</option>
                {availableBands.map((band) => (
                  <option key={band.id} value={band.id}>
                    {band.name}
                  </option>
                ))}
              </select>

              <button
                onClick={handleSave}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false)
                  setEditTitle(video.title)
                  setEditEventId(video.event_id || '')
                  setEditBandId(video.band_id || '')
                }}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-white truncate">
              {video.title}
            </h3>
            <p className="text-sm text-gray-400">{video.youtube_video_id}</p>
            <div className="mt-2 flex gap-2 text-sm">
              {video.event_name ? (
                <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-sm">
                  {video.event_name}
                </span>
              ) : (
                <span className="text-gray-500">No event</span>
              )}
              {video.band_name ? (
                <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-sm">
                  {video.band_name}
                </span>
              ) : (
                <span className="text-gray-500">No band</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-2">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white cursor-pointer"
          title="Edit video"
        >
          <EditIcon className="w-5 h-5" />
        </button>
        <button
          onClick={() => onRequestDelete(video)}
          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400 cursor-pointer"
          title="Delete video"
        >
          <DeleteIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
