'use client'

import { useState, useEffect, useCallback } from 'react'
import { SetlistSong, SongType, SetlistStatus } from '@/lib/db'
import { Badge, NumberedIndicator, CompanyBadge } from '@/components/ui'
import { YouTubeIcon, EditIcon, DeleteIcon } from '@/components/icons'

interface Band {
  id: string
  name: string
  order: number
  company_slug?: string
  company_name?: string
  company_icon_url?: string
}

interface SongConflict {
  title: string
  artist: string
  bands: { band_id: string; band_name: string; song_id: string }[]
}

interface SetlistAdminClientProps {
  eventId: string
  eventName?: string // Kept for potential future use
  bands: Band[]
}

export function SetlistAdminClient({
  eventId,
  eventName: _eventName,
  bands,
}: SetlistAdminClientProps) {
  const [setlists, setSetlists] = useState<Record<string, SetlistSong[]>>({})
  const [conflicts, setConflicts] = useState<SongConflict[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedBandId, setSelectedBandId] = useState<string | null>(
    bands[0]?.id || null
  )
  const [isAddingSong, setIsAddingSong] = useState(false)
  const [editingSongId, setEditingSongId] = useState<string | null>(null)

  // Fetch setlists
  const fetchSetlists = useCallback(async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/setlists`)
      if (response.ok) {
        const data = await response.json()
        // Convert array to record by band_id
        const setlistsMap: Record<string, SetlistSong[]> = {}
        for (const bandSetlist of data.setlists) {
          setlistsMap[bandSetlist.band_id] = bandSetlist.songs
        }
        setSetlists(setlistsMap)
        setConflicts(data.conflicts || [])
      }
    } catch (error) {
      console.error('Error fetching setlists:', error)
    } finally {
      setIsLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    fetchSetlists()
  }, [fetchSetlists])

  // Get conflict info for a song
  const getSongConflict = (songId: string): SongConflict | null => {
    return (
      conflicts.find((c) => c.bands.some((b) => b.song_id === songId)) || null
    )
  }

  // Current band's songs
  const currentBandSongs = selectedBandId ? setlists[selectedBandId] || [] : []
  const currentBand = bands.find((b) => b.id === selectedBandId)

  // Lock/unlock handlers
  const handleLockSetlist = async (bandId: string) => {
    try {
      const response = await fetch(`/api/events/${eventId}/setlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lock', bandId }),
      })
      if (response.ok) {
        fetchSetlists()
      }
    } catch (error) {
      console.error('Error locking setlist:', error)
    }
  }

  const handleUnlockSetlist = async (bandId: string) => {
    try {
      const response = await fetch(`/api/events/${eventId}/setlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlock', bandId }),
      })
      if (response.ok) {
        fetchSetlists()
      }
    } catch (error) {
      console.error('Error unlocking setlist:', error)
    }
  }

  // Check if band's setlist is all locked
  const isBandLocked = (bandId: string): boolean => {
    const songs = setlists[bandId] || []
    return songs.length > 0 && songs.every((s) => s.status === 'locked')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white text-xl">Loading setlists...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Conflicts Warning */}
      {conflicts.length > 0 && (
        <div className="bg-warning/20 border border-warning/30 rounded-xl p-4 mb-8">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="text-warning font-semibold mb-2">
                {conflicts.length} Song Conflict
                {conflicts.length > 1 ? 's' : ''} Detected
              </h3>
              <ul className="space-y-1 text-sm text-warning/80">
                {conflicts.map((conflict, i) => (
                  <li key={i}>
                    <strong>&quot;{conflict.title}&quot;</strong> by{' '}
                    {conflict.artist} is in:{' '}
                    {conflict.bands.map((b) => b.band_name).join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-8">
        {/* Band Selector Sidebar */}
        <div className="w-64 shrink-0">
          <h2 className="text-sm tracking-widest uppercase text-text-dim mb-4">
            Bands
          </h2>
          <div className="space-y-2">
            {bands.map((band) => {
              const songCount = (setlists[band.id] || []).length
              const isLocked = isBandLocked(band.id)
              const hasConflicts = (setlists[band.id] || []).some(
                (s) => s.status === 'conflict'
              )

              return (
                <button
                  key={band.id}
                  onClick={() => {
                    setSelectedBandId(band.id)
                    setIsAddingSong(false)
                    setEditingSongId(null)
                  }}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedBandId === band.id
                      ? 'bg-accent/20 border border-accent/40'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <NumberedIndicator
                      number={band.order}
                      shape="square"
                      size="sm"
                      variant="muted"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">
                        {band.name}
                      </div>
                      <div className="text-xs text-text-dim">
                        {songCount} song{songCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {hasConflicts && (
                        <span className="text-warning text-xs">⚠️</span>
                      )}
                      {isLocked && (
                        <span className="text-success text-xs">🔒</span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {selectedBandId && currentBand ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              {/* Band Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-white">
                    {currentBand.name}
                  </h2>
                  {currentBand.company_slug && currentBand.company_name && (
                    <CompanyBadge
                      slug={currentBand.company_slug}
                      name={currentBand.company_name}
                      iconUrl={currentBand.company_icon_url}
                      size="sm"
                    />
                  )}
                </div>
                <div className="flex gap-2">
                  {isBandLocked(selectedBandId) ? (
                    <button
                      onClick={() => handleUnlockSetlist(selectedBandId)}
                      className="bg-white/10 hover:bg-white/20 text-white text-sm py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                    >
                      🔓 Unlock
                    </button>
                  ) : (
                    <button
                      onClick={() => handleLockSetlist(selectedBandId)}
                      className="bg-success/20 hover:bg-success/30 text-success text-sm py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                    >
                      🔒 Lock Setlist
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsAddingSong(true)
                      setEditingSongId(null)
                    }}
                    className="bg-accent hover:bg-accent-light text-white text-sm py-2 px-4 rounded-lg transition-colors"
                  >
                    + Add Song
                  </button>
                </div>
              </div>

              {/* Add/Edit Song Form */}
              {(isAddingSong || editingSongId) && (
                <SongForm
                  bandId={selectedBandId}
                  editSong={
                    editingSongId
                      ? currentBandSongs.find((s) => s.id === editingSongId)
                      : undefined
                  }
                  nextPosition={currentBandSongs.length + 1}
                  onSave={() => {
                    setIsAddingSong(false)
                    setEditingSongId(null)
                    fetchSetlists()
                  }}
                  onCancel={() => {
                    setIsAddingSong(false)
                    setEditingSongId(null)
                  }}
                />
              )}

              {/* Songs List */}
              {currentBandSongs.length === 0 && !isAddingSong ? (
                <div className="text-center py-12 text-text-muted">
                  <p className="text-lg mb-2">No songs in setlist yet</p>
                  <p className="text-sm">
                    Click &quot;Add Song&quot; to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentBandSongs.map((song) => (
                    <SongRow
                      key={song.id}
                      song={song}
                      conflict={getSongConflict(song.id)}
                      onEdit={() => {
                        setEditingSongId(song.id)
                        setIsAddingSong(false)
                      }}
                      onDelete={async () => {
                        if (!confirm('Delete this song from the setlist?'))
                          return
                        try {
                          await fetch(
                            `/api/setlist/${selectedBandId}/${song.id}`,
                            { method: 'DELETE' }
                          )
                          fetchSetlists()
                        } catch (error) {
                          console.error('Error deleting song:', error)
                        }
                      }}
                      isEditing={editingSongId === song.id}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center text-text-muted">
              <p>Select a band to manage their setlist</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Song Row Component
interface SongRowProps {
  song: SetlistSong
  conflict: SongConflict | null
  onEdit: () => void
  onDelete: () => void
  isEditing: boolean
}

function SongRow({
  song,
  conflict,
  onEdit,
  onDelete,
  isEditing,
}: SongRowProps) {
  const statusVariant: Record<
    SetlistStatus,
    'default' | 'success' | 'warning'
  > = {
    pending: 'default',
    locked: 'success',
    conflict: 'warning',
  }

  return (
    <div
      className={`bg-white/5 rounded-lg p-4 flex items-center gap-4 ${
        isEditing ? 'ring-2 ring-accent' : ''
      } ${conflict ? 'border border-warning/30' : ''}`}
    >
      {/* Position */}
      <NumberedIndicator
        number={song.position}
        shape="circle"
        size="md"
        variant="default"
      />

      {/* Song Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-white">{song.title}</span>
          {song.song_type === 'transition' && song.transition_to_title && (
            <>
              <span className="text-text-dim">→</span>
              <span className="font-medium text-white">
                {song.transition_to_title}
              </span>
            </>
          )}
          <SongTypeBadge type={song.song_type} />
        </div>
        <div className="text-sm text-text-muted mt-1">
          {song.artist}
          {song.song_type === 'transition' && song.transition_to_artist && (
            <> / {song.transition_to_artist}</>
          )}
          {song.additional_songs && song.additional_songs.length > 0 && (
            <>
              {' '}
              +{' '}
              {song.additional_songs
                .map((s) => `${s.title} (${s.artist})`)
                .join(', ')}
            </>
          )}
        </div>
        {conflict && (
          <div className="text-xs text-warning mt-1">
            ⚠️ Also in:{' '}
            {conflict.bands
              .filter((b) => b.song_id !== song.id)
              .map((b) => b.band_name)
              .join(', ')}
          </div>
        )}
      </div>

      {/* Status */}
      <Badge variant={statusVariant[song.status]}>{song.status}</Badge>

      {/* YouTube Link */}
      {song.youtube_video_id && (
        <a
          href={`https://www.youtube.com/watch?v=${song.youtube_video_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-dim hover:text-accent transition-colors"
          title="Watch on YouTube"
        >
          <YouTubeIcon size={20} />
        </a>
      )}

      {/* Actions */}
      <div className="flex gap-1">
        <button
          onClick={onEdit}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-text-dim hover:text-white"
          title="Edit"
        >
          <EditIcon className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-text-dim hover:text-red-400"
          title="Delete"
        >
          <DeleteIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// Song Type Badge Component
function SongTypeBadge({ type }: { type: SongType }) {
  const config: Record<
    SongType,
    { label: string; variant: 'default' | 'accent' | 'info' | 'success' }
  > = {
    cover: { label: 'Cover', variant: 'default' },
    mashup: { label: 'Mashup', variant: 'accent' },
    medley: { label: 'Medley', variant: 'info' },
    transition: { label: 'Transition', variant: 'success' },
  }

  return (
    <Badge variant={config[type].variant} className="text-[10px] py-0.5 px-2">
      {config[type].label}
    </Badge>
  )
}

// Song Form Component
interface SongFormProps {
  bandId: string
  editSong?: SetlistSong
  nextPosition: number
  onSave: () => void
  onCancel: () => void
}

function SongForm({
  bandId,
  editSong,
  nextPosition,
  onSave,
  onCancel,
}: SongFormProps) {
  const [songType, setSongType] = useState<SongType>(
    editSong?.song_type || 'cover'
  )
  const [title, setTitle] = useState(editSong?.title || '')
  const [artist, setArtist] = useState(editSong?.artist || '')
  const [position, setPosition] = useState(editSong?.position || nextPosition)
  const [transitionToTitle, setTransitionToTitle] = useState(
    editSong?.transition_to_title || ''
  )
  const [transitionToArtist, setTransitionToArtist] = useState(
    editSong?.transition_to_artist || ''
  )
  const [youtubeVideoId, setYoutubeVideoId] = useState(
    editSong?.youtube_video_id || ''
  )
  const [additionalSongs, setAdditionalSongs] = useState<
    { title: string; artist: string }[]
  >(editSong?.additional_songs || [])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const body = {
      position,
      song_type: songType,
      title,
      artist,
      additional_songs: additionalSongs.filter((s) => s.title && s.artist),
      transition_to_title: songType === 'transition' ? transitionToTitle : null,
      transition_to_artist:
        songType === 'transition' ? transitionToArtist : null,
      youtube_video_id: youtubeVideoId || null,
    }

    try {
      const url = editSong
        ? `/api/setlist/${bandId}/${editSong.id}`
        : `/api/setlist/${bandId}`
      const method = editSong ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        onSave()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to save song')
      }
    } catch (err) {
      setError('Failed to save song')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const addAdditionalSong = () => {
    setAdditionalSongs([...additionalSongs, { title: '', artist: '' }])
  }

  const removeAdditionalSong = (index: number) => {
    setAdditionalSongs(additionalSongs.filter((_, i) => i !== index))
  }

  const updateAdditionalSong = (
    index: number,
    field: 'title' | 'artist',
    value: string
  ) => {
    const updated = [...additionalSongs]
    updated[index][field] = value
    setAdditionalSongs(updated)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-bg-surface rounded-lg p-6 mb-6 space-y-4"
    >
      <h3 className="text-lg font-semibold text-white mb-4">
        {editSong ? 'Edit Song' : 'Add Song'}
      </h3>

      {/* Song Type */}
      <div>
        <label className="block text-sm font-medium text-text-muted mb-2">
          Type
        </label>
        <div className="flex gap-2">
          {(['cover', 'mashup', 'medley', 'transition'] as SongType[]).map(
            (type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSongType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  songType === type
                    ? 'bg-accent text-white'
                    : 'bg-white/10 text-text-muted hover:bg-white/20'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Position */}
        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">
            Position
          </label>
          <input
            type="number"
            min="1"
            value={position}
            onChange={(e) => setPosition(parseInt(e.target.value) || 1)}
            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:border-accent focus:outline-hidden"
          />
        </div>

        {/* YouTube Video ID */}
        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">
            YouTube Video ID (optional)
          </label>
          <input
            type="text"
            value={youtubeVideoId}
            onChange={(e) => setYoutubeVideoId(e.target.value)}
            placeholder="dQw4w9WgXcQ"
            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-text-dim focus:border-accent focus:outline-hidden"
          />
        </div>
      </div>

      {/* Primary Song */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">
            {songType === 'transition' ? 'From Song Title' : 'Title'} *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Don't Stop Me Now"
            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-text-dim focus:border-accent focus:outline-hidden"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">
            {songType === 'transition' ? 'From Artist' : 'Artist'} *
          </label>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Queen"
            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-text-dim focus:border-accent focus:outline-hidden"
            required
          />
        </div>
      </div>

      {/* Transition To Song */}
      {songType === 'transition' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              To Song Title *
            </label>
            <input
              type="text"
              value={transitionToTitle}
              onChange={(e) => setTransitionToTitle(e.target.value)}
              placeholder="Umbrella"
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-text-dim focus:border-accent focus:outline-hidden"
              required={songType === 'transition'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              To Artist *
            </label>
            <input
              type="text"
              value={transitionToArtist}
              onChange={(e) => setTransitionToArtist(e.target.value)}
              placeholder="Rihanna"
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-text-dim focus:border-accent focus:outline-hidden"
              required={songType === 'transition'}
            />
          </div>
        </div>
      )}

      {/* Additional Songs (for mashup/medley) */}
      {(songType === 'mashup' || songType === 'medley') && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-text-muted">
              Additional Songs
            </label>
            <button
              type="button"
              onClick={addAdditionalSong}
              className="text-sm text-accent hover:text-accent-light"
            >
              + Add Another Song
            </button>
          </div>
          {additionalSongs.map((song, index) => (
            <div key={index} className="grid grid-cols-2 gap-4 mb-2">
              <input
                type="text"
                value={song.title}
                onChange={(e) =>
                  updateAdditionalSong(index, 'title', e.target.value)
                }
                placeholder="Song title"
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-text-dim focus:border-accent focus:outline-hidden"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={song.artist}
                  onChange={(e) =>
                    updateAdditionalSong(index, 'artist', e.target.value)
                  }
                  placeholder="Artist"
                  className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-text-dim focus:border-accent focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => removeAdditionalSong(index)}
                  className="p-2 text-text-dim hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-error/20 border border-error/30 text-error px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-accent hover:bg-accent-light text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : editSong ? 'Update Song' : 'Add Song'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-white/10 hover:bg-white/20 text-white font-medium py-2 px-6 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
