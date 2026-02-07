'use client'

import { useState } from 'react'
import { Video, VideoType } from '@/lib/db'
import { EditIcon, DeleteIcon, CloseIcon, PlusIcon } from '@/components/icons'
import { ConfirmModal, Button, Card, Tabs, type Tab } from '@/components/ui'
import { YouTubeScanner } from './youtube-scanner'
import { VideoShareButton } from './video-social-post'

type TypeFilter = 'all' | 'video' | 'short'

interface VideoAdminClientProps {
  initialVideos: Video[]
  events: { id: string; name: string }[]
  bandsMap: Record<string, { id: string; name: string }[]>
}

/**
 * Detect if URL is a YouTube Short
 */
function isYoutubeShort(url: string): boolean {
  return url.includes('/shorts/')
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
  const [selectedVideoType, setSelectedVideoType] = useState<VideoType>('video')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)

  // Type filter state
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<Video | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Get bands for selected event
  const availableBands = selectedEventId ? bandsMap[selectedEventId] || [] : []

  // Auto-detect video type from URL
  const handleYoutubeUrlChange = (url: string) => {
    setYoutubeUrl(url)
    // Auto-detect type from URL
    if (isYoutubeShort(url)) {
      setSelectedVideoType('short')
    }
  }

  // Filter videos by type
  const filteredVideos =
    typeFilter === 'all'
      ? videos
      : videos.filter((v) => v.video_type === typeFilter)

  // Count videos by type
  const videoCount = videos.filter((v) => v.video_type === 'video').length
  const shortCount = videos.filter((v) => v.video_type === 'short').length

  // Tabs configuration
  const tabs: Tab[] = [
    { id: 'all', label: 'All', count: videos.length },
    { id: 'video', label: 'Videos', count: videoCount },
    { id: 'short', label: 'Shorts', count: shortCount },
  ]

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
          videoType: selectedVideoType,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setVideos([data.video, ...videos])
        setYoutubeUrl('')
        setTitle('')
        setSelectedEventId('')
        setSelectedBandId('')
        setSelectedVideoType('video')
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
    bandId: string | null,
    videoType?: VideoType
  ) => {
    setOperationError(null)
    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, eventId, bandId, videoType }),
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

  // Refresh videos list after YouTube import
  async function refreshVideos() {
    try {
      const response = await fetch('/api/videos?limit=100')
      if (response.ok) {
        const data = await response.json()
        setVideos(data.videos || [])
      }
    } catch (err) {
      console.error('Failed to refresh videos:', err)
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

      {/* Action Buttons */}
      <div className="flex items-start justify-end gap-3">
        <YouTubeScanner
          events={events}
          bandsMap={bandsMap}
          onVideosImported={refreshVideos}
        />
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
                onChange={(e) => handleYoutubeUrlChange(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or /shorts/..."
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

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Video Type *
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="videoType"
                    value="video"
                    checked={selectedVideoType === 'video'}
                    onChange={() => setSelectedVideoType('video')}
                    className="w-4 h-4 text-accent bg-white/5 border-white/20 focus:ring-accent"
                  />
                  <span className="text-white">Regular Video</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="videoType"
                    value="short"
                    checked={selectedVideoType === 'short'}
                    onChange={() => setSelectedVideoType('short')}
                    className="w-4 h-4 text-accent bg-white/5 border-white/20 focus:ring-accent"
                  />
                  <span className="text-white">YouTube Short</span>
                </label>
              </div>
              {selectedVideoType === 'short' && (
                <p className="mt-1 text-xs text-gray-400">
                  Shorts are vertical videos (9:16 aspect ratio)
                </p>
              )}
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
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-white">
            Videos ({filteredVideos.length})
          </h2>

          {/* Type Filter Tabs */}
          <Tabs
            tabs={tabs}
            activeTab={typeFilter}
            onTabChange={(id) => setTypeFilter(id as TypeFilter)}
            aria-label="Filter by video type"
          />
        </div>

        {filteredVideos.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-300 text-lg">
              {videos.length === 0
                ? 'No videos found'
                : `No ${typeFilter === 'short' ? 'shorts' : 'videos'} found`}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              {videos.length === 0
                ? 'Add your first video to get started'
                : typeFilter !== 'all' && 'Try changing the filter'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredVideos.map((video) => (
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
    bandId: string | null,
    videoType?: VideoType
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
  const [editVideoType, setEditVideoType] = useState<VideoType>(
    video.video_type || 'video'
  )

  const availableBands = editEventId ? bandsMap[editEventId] || [] : []
  const isShort = video.video_type === 'short'

  const handleSave = async () => {
    await onUpdate(
      video.id,
      editTitle,
      editEventId || null,
      editBandId || null,
      editVideoType
    )
    setIsEditing(false)
  }

  // Get YouTube URL based on type
  const youtubeUrl = isShort
    ? `https://www.youtube.com/shorts/${video.youtube_video_id}`
    : `https://www.youtube.com/watch?v=${video.youtube_video_id}`

  return (
    <div className="bg-surface rounded-xl p-4 flex gap-4">
      {/* Thumbnail - Portrait for shorts, landscape for videos */}
      <a
        href={youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            video.thumbnail_url ||
            `https://i.ytimg.com/vi/${video.youtube_video_id}/hq720.jpg`
          }
          alt={video.title}
          className={`object-cover rounded-lg hover:opacity-80 transition-opacity ${
            isShort ? 'w-16 h-28' : 'w-32 h-20'
          }`}
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
              {/* Video Type Selector */}
              <select
                value={editVideoType}
                onChange={(e) => setEditVideoType(e.target.value as VideoType)}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-white text-sm"
              >
                <option value="video">Video</option>
                <option value="short">Short</option>
              </select>

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
                  setEditVideoType(video.video_type || 'video')
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
            <div className="mt-2 flex gap-2 text-sm flex-wrap">
              {/* Type badge */}
              {isShort ? (
                <span className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded-sm font-medium">
                  SHORT
                </span>
              ) : (
                <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-sm font-medium">
                  VIDEO
                </span>
              )}
              {video.event_name ? (
                <span className="bg-white/10 text-gray-300 px-2 py-0.5 rounded-sm">
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
        <VideoShareButton video={video} />
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
