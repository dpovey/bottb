'use client'

import { useState } from 'react'
import { Button, Card } from '@/components/ui'
import { CloseIcon, CheckIcon } from '@/components/icons'

// YouTube icon component
function YouTubeIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

// Refresh icon component
function RefreshIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  )
}

interface ScannedVideo {
  videoId: string
  title: string
  description: string
  publishedAt: string
  thumbnailUrl: string | null
  isShort: boolean
  alreadyInDatabase: boolean
  suggestedTitle: string
  matchConfidence: 'high' | 'medium' | 'low' | 'none'
  eventMatch: {
    id: string
    name: string
    confidence: string
  } | null
  bandMatch: {
    id: string
    name: string
    confidence: string
  } | null
}

interface ScanResult {
  channelHandle: string
  channelTitle: string
  totalOnChannel: number
  totalFetched: number
  totalNew: number
  totalInDatabase: number
  videos: ScannedVideo[]
}

interface YouTubeScannerProps {
  events: { id: string; name: string }[]
  bandsMap: Record<string, { id: string; name: string }[]>
  onVideosImported: () => void
}

export function YouTubeScanner({
  events,
  bandsMap,
  onVideosImported,
}: YouTubeScannerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set())
  const [isImporting, setIsImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)

  // Track overrides for event/band selections
  const [videoOverrides, setVideoOverrides] = useState<
    Record<string, { eventId?: string; bandId?: string; title?: string }>
  >({})

  const handleScan = async () => {
    setIsScanning(true)
    setError(null)
    setScanResult(null)
    setSelectedVideos(new Set())
    setVideoOverrides({})
    setImportMessage(null)

    try {
      const response = await fetch('/api/admin/youtube/scan?maxResults=100')
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to scan channel')
      }

      const data: ScanResult = await response.json()
      setScanResult(data)

      // Auto-select new videos with high/medium confidence
      const autoSelect = new Set<string>()
      for (const video of data.videos) {
        if (
          !video.alreadyInDatabase &&
          (video.matchConfidence === 'high' ||
            video.matchConfidence === 'medium')
        ) {
          autoSelect.add(video.videoId)
        }
      }
      setSelectedVideos(autoSelect)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan channel')
    } finally {
      setIsScanning(false)
    }
  }

  const handleImport = async () => {
    if (selectedVideos.size === 0) return

    setIsImporting(true)
    setError(null)
    setImportMessage(null)

    try {
      const videosToImport = scanResult?.videos
        .filter((v) => selectedVideos.has(v.videoId))
        .map((v) => {
          const override = videoOverrides[v.videoId] || {}
          return {
            videoId: v.videoId,
            title: override.title || v.suggestedTitle,
            eventId: override.eventId ?? v.eventMatch?.id ?? null,
            bandId: override.bandId ?? v.bandMatch?.id ?? null,
            isShort: v.isShort,
          }
        })

      const response = await fetch('/api/admin/youtube/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos: videosToImport }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import videos')
      }

      setImportMessage(data.message)

      // Remove imported videos from selection and results
      if (data.successCount > 0) {
        const importedIds = new Set(
          data.results
            .filter((r: { success: boolean }) => r.success)
            .map((r: { videoId: string }) => r.videoId)
        )
        setSelectedVideos(
          new Set([...selectedVideos].filter((id) => !importedIds.has(id)))
        )

        // Mark as already in database
        if (scanResult) {
          setScanResult({
            ...scanResult,
            videos: scanResult.videos.map((v) =>
              importedIds.has(v.videoId) ? { ...v, alreadyInDatabase: true } : v
            ),
          })
        }

        // Notify parent to refresh video list
        onVideosImported()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import videos')
    } finally {
      setIsImporting(false)
    }
  }

  const toggleVideo = (videoId: string) => {
    const newSelection = new Set(selectedVideos)
    if (newSelection.has(videoId)) {
      newSelection.delete(videoId)
    } else {
      newSelection.add(videoId)
    }
    setSelectedVideos(newSelection)
  }

  const selectAll = () => {
    if (!scanResult) return
    const allNew = scanResult.videos
      .filter((v) => !v.alreadyInDatabase)
      .map((v) => v.videoId)
    setSelectedVideos(new Set(allNew))
  }

  const selectNone = () => {
    setSelectedVideos(new Set())
  }

  const updateOverride = (
    videoId: string,
    field: 'eventId' | 'bandId' | 'title',
    value: string
  ) => {
    setVideoOverrides((prev) => ({
      ...prev,
      [videoId]: {
        ...prev[videoId],
        [field]: value,
      },
    }))
  }

  if (!isOpen) {
    return (
      <Button
        variant="outline-solid"
        onClick={() => {
          setIsOpen(true)
          handleScan()
        }}
      >
        <YouTubeIcon className="w-5 h-5" />
        Scan YouTube Channel
      </Button>
    )
  }

  return (
    <Card className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <YouTubeIcon className="w-6 h-6 text-red-500" />
            YouTube Channel Scanner
          </h2>
          {scanResult && (
            <p className="text-sm text-gray-400 mt-1">
              @{scanResult.channelHandle} • {scanResult.totalOnChannel} total
              videos • {scanResult.totalNew} new
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={handleScan}
            disabled={isScanning}
            title="Refresh scan"
          >
            <RefreshIcon
              className={`w-5 h-5 ${isScanning ? 'animate-spin' : ''}`}
            />
          </Button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <CloseIcon size={20} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-error/20 border border-error/50 text-error px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Import Message */}
      {importMessage && (
        <div className="bg-green-500/20 border border-green-500/50 text-green-300 px-4 py-3 rounded-lg mb-4">
          {importMessage}
        </div>
      )}

      {/* Loading */}
      {isScanning && (
        <div className="text-center py-12">
          <RefreshIcon className="w-8 h-8 animate-spin mx-auto mb-4 text-accent" />
          <p className="text-gray-300">Scanning YouTube channel...</p>
        </div>
      )}

      {/* Results */}
      {scanResult && !isScanning && (
        <>
          {/* Selection controls */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-4">
              <span className="text-gray-400">
                {selectedVideos.size} selected
              </span>
              <button
                onClick={selectAll}
                className="text-sm text-accent hover:underline"
              >
                Select all new
              </button>
              <button
                onClick={selectNone}
                className="text-sm text-gray-400 hover:text-white"
              >
                Clear
              </button>
            </div>
            <Button
              variant="accent"
              onClick={handleImport}
              disabled={selectedVideos.size === 0 || isImporting}
            >
              {isImporting
                ? 'Importing...'
                : `Import ${selectedVideos.size} Videos`}
            </Button>
          </div>

          {/* Video list */}
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {scanResult.videos.length === 0 ? (
              <p className="text-center text-gray-400 py-8">
                No new videos found on the channel
              </p>
            ) : (
              scanResult.videos.map((video) => (
                <ScannedVideoRow
                  key={video.videoId}
                  video={video}
                  isSelected={selectedVideos.has(video.videoId)}
                  onToggle={() => toggleVideo(video.videoId)}
                  events={events}
                  bandsMap={bandsMap}
                  override={videoOverrides[video.videoId]}
                  onUpdateOverride={(field, value) =>
                    updateOverride(video.videoId, field, value)
                  }
                />
              ))
            )}
          </div>
        </>
      )}
    </Card>
  )
}

interface ScannedVideoRowProps {
  video: ScannedVideo
  isSelected: boolean
  onToggle: () => void
  events: { id: string; name: string }[]
  bandsMap: Record<string, { id: string; name: string }[]>
  override?: { eventId?: string; bandId?: string; title?: string }
  onUpdateOverride: (
    field: 'eventId' | 'bandId' | 'title',
    value: string
  ) => void
}

function ScannedVideoRow({
  video,
  isSelected,
  onToggle,
  events,
  bandsMap,
  override,
  onUpdateOverride,
}: ScannedVideoRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const effectiveEventId = override?.eventId ?? video.eventMatch?.id ?? ''
  const effectiveBandId = override?.bandId ?? video.bandMatch?.id ?? ''
  const availableBands = effectiveEventId
    ? bandsMap[effectiveEventId] || []
    : []

  const confidenceColors = {
    high: 'bg-green-500/20 text-green-300 border-green-500/50',
    medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
    low: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
    none: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  }

  const youtubeUrl = video.isShort
    ? `https://www.youtube.com/shorts/${video.videoId}`
    : `https://www.youtube.com/watch?v=${video.videoId}`

  return (
    <div
      className={`rounded-xl p-4 transition-colors ${
        video.alreadyInDatabase
          ? 'bg-white/5 opacity-50'
          : isSelected
            ? 'bg-accent/10 border border-accent/30'
            : 'bg-surface hover:bg-surface-hover'
      }`}
    >
      <div className="flex gap-4">
        {/* Checkbox */}
        <div className="shrink-0 pt-1">
          <button
            onClick={onToggle}
            disabled={video.alreadyInDatabase}
            className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
              video.alreadyInDatabase
                ? 'border-gray-600 cursor-not-allowed'
                : isSelected
                  ? 'bg-accent border-accent text-white'
                  : 'border-white/30 hover:border-white/50'
            }`}
          >
            {isSelected && <CheckIcon className="w-4 h-4" />}
          </button>
        </div>

        {/* Thumbnail */}
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0"
        >
          {video.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className={`object-cover rounded-lg hover:opacity-80 transition-opacity ${
                video.isShort ? 'w-16 h-28' : 'w-32 h-20'
              }`}
            />
          ) : (
            <div
              className={`bg-gray-700 rounded-lg flex items-center justify-center ${
                video.isShort ? 'w-16 h-28' : 'w-32 h-20'
              }`}
            >
              <YouTubeIcon className="w-8 h-8 text-gray-500" />
            </div>
          )}
        </a>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white truncate">{video.title}</h3>
          <p className="text-sm text-gray-400 truncate mt-1">
            {new Date(video.publishedAt).toLocaleDateString()}
          </p>

          {/* Badges */}
          <div className="mt-2 flex gap-2 flex-wrap">
            {video.isShort && (
              <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-sm">
                SHORT
              </span>
            )}
            {video.alreadyInDatabase && (
              <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-sm">
                IN DATABASE
              </span>
            )}
            <span
              className={`text-xs px-2 py-0.5 rounded-sm border ${confidenceColors[video.matchConfidence]}`}
            >
              {video.matchConfidence.toUpperCase()} MATCH
            </span>
            {video.eventMatch && (
              <span className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-sm">
                {video.eventMatch.name}
              </span>
            )}
            {video.bandMatch && (
              <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-sm">
                {video.bandMatch.name}
              </span>
            )}
          </div>

          {/* Expand/collapse for editing */}
          {!video.alreadyInDatabase && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 text-sm text-accent hover:underline"
            >
              {isExpanded ? 'Hide options' : 'Edit match'}
            </button>
          )}

          {/* Expanded edit form */}
          {isExpanded && !video.alreadyInDatabase && (
            <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
              {/* Title override */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={override?.title ?? video.suggestedTitle}
                  onChange={(e) => onUpdateOverride('title', e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Event selector */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Event
                  </label>
                  <select
                    value={effectiveEventId}
                    onChange={(e) => {
                      onUpdateOverride('eventId', e.target.value)
                      onUpdateOverride('bandId', '') // Reset band
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-white text-sm"
                  >
                    <option value="">No Event</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Band selector */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Band
                  </label>
                  <select
                    value={effectiveBandId}
                    onChange={(e) => onUpdateOverride('bandId', e.target.value)}
                    disabled={!effectiveEventId}
                    className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-white text-sm disabled:opacity-50"
                  >
                    <option value="">No Band</option>
                    {availableBands.map((band) => (
                      <option key={band.id} value={band.id}>
                        {band.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
