'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Photo, PHOTO_LABELS } from '@/lib/db-types'
import { Button, VinylSpinner, Modal } from '@/components/ui'
import { CheckIcon } from '@/components/icons'
import { CropPreview } from '@/components/photos/focal-point-editor'

// Label display info
const LABEL_INFO = {
  [PHOTO_LABELS.BAND_HERO]: {
    name: 'Band Hero',
    description: 'Featured on band page',
    icon: '🎸',
    color: 'bg-purple-500/20 border-purple-500/30 text-purple-300',
  },
  [PHOTO_LABELS.EVENT_HERO]: {
    name: 'Event Hero',
    description: 'Featured on event page',
    icon: '🎪',
    color: 'bg-amber-500/20 border-amber-500/30 text-amber-300',
  },
  [PHOTO_LABELS.GLOBAL_HERO]: {
    name: 'Global Hero',
    description: 'Featured on home page',
    icon: '🏠',
    color: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300',
  },
  [PHOTO_LABELS.PHOTOGRAPHER_HERO]: {
    name: 'Photographer Hero',
    description: 'Featured on photographer page',
    icon: '📷',
    color: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
  },
} as const

type LabelKey = keyof typeof LABEL_INFO

interface HeroAdminClientProps {
  initialPhotos: Photo[]
  events: { id: string; name: string }[]
  bandsMap: Record<string, { id: string; name: string }[]>
}

export function HeroAdminClient({
  initialPhotos,
  events,
  bandsMap,
}: HeroAdminClientProps) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [filterLabel, setFilterLabel] = useState<string>('')
  const [filterEvent, setFilterEvent] = useState<string>('')
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  // Filter photos
  const filteredPhotos = photos.filter((photo) => {
    if (filterLabel && !photo.labels.includes(filterLabel)) return false
    if (filterEvent && photo.event_id !== filterEvent) return false
    return true
  })

  // Group photos by label type
  const photosByLabel = {
    [PHOTO_LABELS.GLOBAL_HERO]: filteredPhotos.filter((p) =>
      p.labels.includes(PHOTO_LABELS.GLOBAL_HERO)
    ),
    [PHOTO_LABELS.EVENT_HERO]: filteredPhotos.filter((p) =>
      p.labels.includes(PHOTO_LABELS.EVENT_HERO)
    ),
    [PHOTO_LABELS.BAND_HERO]: filteredPhotos.filter((p) =>
      p.labels.includes(PHOTO_LABELS.BAND_HERO)
    ),
    [PHOTO_LABELS.PHOTOGRAPHER_HERO]: filteredPhotos.filter((p) =>
      p.labels.includes(PHOTO_LABELS.PHOTOGRAPHER_HERO)
    ),
  }

  const handlePhotoClick = (photo: Photo) => {
    setSelectedPhoto(photo)
    setShowPreviewModal(true)
  }

  const handleFocalPointUpdate = (
    photoId: string,
    focalPoint: { x: number; y: number }
  ) => {
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photoId ? { ...p, hero_focal_point: focalPoint } : p
      )
    )
    if (selectedPhoto?.id === photoId) {
      setSelectedPhoto((prev) =>
        prev ? { ...prev, hero_focal_point: focalPoint } : null
      )
    }
  }

  const handleLabelsUpdate = (photoId: string, labels: string[]) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, labels } : p))
    )
    if (selectedPhoto?.id === photoId) {
      setSelectedPhoto((prev) => (prev ? { ...prev, labels } : null))
    }
  }

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-muted">Label:</label>
          <select
            value={filterLabel}
            onChange={(e) => setFilterLabel(e.target.value)}
            className="px-3 py-2 rounded-lg bg-bg-elevated border border-white/10 text-white text-sm focus:border-accent focus:outline-none"
          >
            <option value="">All Labels</option>
            {Object.entries(LABEL_INFO).map(([key, info]) => (
              <option key={key} value={key}>
                {info.icon} {info.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-text-muted">Event:</label>
          <select
            value={filterEvent}
            onChange={(e) => setFilterEvent(e.target.value)}
            className="px-3 py-2 rounded-lg bg-bg-elevated border border-white/10 text-white text-sm focus:border-accent focus:outline-none"
          >
            <option value="">All Events</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto text-sm text-text-muted">
          {filteredPhotos.length} hero photo
          {filteredPhotos.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(LABEL_INFO).map(([key, info]) => (
          <div
            key={key}
            className={`p-4 rounded-xl border ${info.color} cursor-pointer transition-all hover:scale-[1.02]`}
            onClick={() => setFilterLabel(filterLabel === key ? '' : key)}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{info.icon}</span>
              <div>
                <div className="text-2xl font-bold">
                  {photosByLabel[key as LabelKey]?.length || 0}
                </div>
                <div className="text-sm opacity-80">{info.name}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Photo Grid by Section */}
      {filterLabel ? (
        // Single section when filtered
        <PhotoSection
          label={filterLabel as LabelKey}
          photos={filteredPhotos}
          onPhotoClick={handlePhotoClick}
        />
      ) : (
        // All sections when not filtered
        Object.entries(photosByLabel).map(
          ([label, labelPhotos]) =>
            labelPhotos.length > 0 && (
              <PhotoSection
                key={label}
                label={label as LabelKey}
                photos={labelPhotos}
                onPhotoClick={handlePhotoClick}
              />
            )
        )
      )}

      {filteredPhotos.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <p className="text-lg">No hero photos found</p>
          <p className="text-sm mt-2">
            Add hero labels to photos in the photo gallery to see them here
          </p>
        </div>
      )}

      {/* Preview Modal */}
      {selectedPhoto && (
        <HeroPreviewModal
          isOpen={showPreviewModal}
          photo={selectedPhoto}
          events={events}
          bandsMap={bandsMap}
          onClose={() => {
            setShowPreviewModal(false)
            setSelectedPhoto(null)
          }}
          onFocalPointUpdate={handleFocalPointUpdate}
          onLabelsUpdate={handleLabelsUpdate}
        />
      )}
    </div>
  )
}

// Photo Section Component
function PhotoSection({
  label,
  photos,
  onPhotoClick,
}: {
  label: LabelKey
  photos: Photo[]
  onPhotoClick: (photo: Photo) => void
}) {
  const info = LABEL_INFO[label]
  if (!info) return null

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{info.icon}</span>
        <h2 className="text-xl font-semibold">{info.name}</h2>
        <span className="text-text-muted text-sm">({photos.length})</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {photos.map((photo) => (
          <PhotoCard key={photo.id} photo={photo} onClick={onPhotoClick} />
        ))}
      </div>
    </section>
  )
}

// Photo Card Component
function PhotoCard({
  photo,
  onClick,
}: {
  photo: Photo
  onClick: (photo: Photo) => void
}) {
  return (
    <div
      className="group relative aspect-square rounded-lg overflow-hidden cursor-pointer border border-white/10 hover:border-accent/50 transition-all"
      onClick={() => onClick(photo)}
    >
      <Image
        src={photo.thumbnail_url || photo.blob_url}
        alt={photo.original_filename || 'Hero photo'}
        fill
        className="object-cover group-hover:scale-105 transition-transform duration-300"
        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
      />

      {/* Focal point indicator */}
      <div
        className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          left: `${photo.hero_focal_point?.x ?? 50}%`,
          top: `${photo.hero_focal_point?.y ?? 50}%`,
        }}
      >
        <div className="absolute inset-0 border-2 border-white rounded-full shadow-lg" />
        <div className="absolute inset-[4px] bg-accent rounded-full" />
      </div>

      {/* Overlay with info */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="flex flex-wrap gap-1 mb-1">
            {photo.labels.map((label) => {
              const labelInfo = LABEL_INFO[label as LabelKey]
              return labelInfo ? (
                <span
                  key={label}
                  className="text-xs px-1.5 py-0.5 rounded bg-white/20"
                >
                  {labelInfo.icon}
                </span>
              ) : null
            })}
          </div>
          {photo.event_name && (
            <div className="text-xs text-white/80 truncate">
              {photo.event_name}
            </div>
          )}
          {photo.band_name && (
            <div className="text-xs text-white/60 truncate">
              {photo.band_name}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Hero Preview Modal with Crop Previews
interface HeroPreviewModalProps {
  isOpen: boolean
  photo: Photo
  events: { id: string; name: string }[]
  bandsMap: Record<string, { id: string; name: string }[]>
  onClose: () => void
  onFocalPointUpdate: (
    photoId: string,
    focalPoint: { x: number; y: number }
  ) => void
  onLabelsUpdate: (photoId: string, labels: string[]) => void
}

function HeroPreviewModal({
  isOpen,
  photo,
  events: _events,
  bandsMap: _bandsMap,
  onClose,
  onFocalPointUpdate,
  onLabelsUpdate,
}: HeroPreviewModalProps) {
  const [focalPoint, setFocalPoint] = useState(
    photo.hero_focal_point ?? { x: 50, y: 50 }
  )
  const [labels, setLabels] = useState<string[]>(photo.labels)
  const [isDragging, setIsDragging] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sourceImageRef = useRef<HTMLDivElement>(null)

  // Update state when photo changes
  useEffect(() => {
    setFocalPoint(photo.hero_focal_point ?? { x: 50, y: 50 })
    setLabels(photo.labels)
  }, [photo])

  const calculateFocalPoint = useCallback(
    (
      e: React.MouseEvent<HTMLDivElement> | MouseEvent,
      element: HTMLDivElement
    ) => {
      const rect = element.getBoundingClientRect()
      const x = Math.max(
        0,
        Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)
      )
      const y = Math.max(
        0,
        Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)
      )
      return { x, y }
    },
    []
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(true)
      const newPoint = calculateFocalPoint(e, e.currentTarget)
      setFocalPoint(newPoint)
    },
    [calculateFocalPoint]
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!sourceImageRef.current) return
      const newPoint = calculateFocalPoint(e, sourceImageRef.current)
      setFocalPoint(newPoint)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, calculateFocalPoint])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/photos/${photo.id}/labels`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels, heroFocalPoint: focalPoint }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }

      onFocalPointUpdate(photo.id, focalPoint)
      onLabelsUpdate(photo.id, labels)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleLabel = (label: string) => {
    setLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    )
  }

  // Get resolution info
  const width = photo.width || 0
  const height = photo.height || 0
  const hasHighRes = width >= 2000 || height >= 2000
  const has4K = width >= 4000 || height >= 4000

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hero Preview & Settings"
      size="full"
      disabled={isSaving}
    >
      <div className="flex flex-col lg:flex-row gap-6 max-h-[80vh] overflow-y-auto">
        {/* Left: Source Image with Focal Point */}
        <div className="lg:w-1/2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-muted">
              Source Image & Focal Point
            </h3>
            <div className="flex items-center gap-2 text-xs">
              {width > 0 && height > 0 && (
                <span className="text-text-dim">
                  {width} × {height}px
                </span>
              )}
              {has4K ? (
                <span className="px-2 py-0.5 rounded bg-success/20 text-success">
                  4K Ready
                </span>
              ) : hasHighRes ? (
                <span className="px-2 py-0.5 rounded bg-info/20 text-info">
                  High Res
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-warning/20 text-warning">
                  Low Res
                </span>
              )}
            </div>
          </div>

          <div
            ref={sourceImageRef}
            className="relative aspect-[4/3] rounded-lg overflow-hidden cursor-crosshair select-none border border-white/10"
            onMouseDown={handleMouseDown}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.blob_url}
              alt="Source"
              className="w-full h-full object-contain bg-black/50"
              draggable={false}
            />
            {/* Focal point indicator */}
            <div
              className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-75"
              style={{ left: `${focalPoint.x}%`, top: `${focalPoint.y}%` }}
            >
              <div className="absolute inset-0 border-2 border-white rounded-full shadow-lg animate-pulse" />
              <div className="absolute inset-[8px] bg-accent rounded-full" />
              {/* Crosshairs */}
              <div className="absolute top-1/2 left-[-20px] w-[16px] h-[2px] bg-white/50 -translate-y-1/2" />
              <div className="absolute top-1/2 right-[-20px] w-[16px] h-[2px] bg-white/50 -translate-y-1/2" />
              <div className="absolute left-1/2 top-[-20px] h-[16px] w-[2px] bg-white/50 -translate-x-1/2" />
              <div className="absolute left-1/2 bottom-[-20px] h-[16px] w-[2px] bg-white/50 -translate-x-1/2" />
            </div>
            {/* Grid */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="border border-white/10" />
              ))}
            </div>
          </div>

          <p className="text-xs text-text-dim text-center">
            Click and drag to set focal point: {Math.round(focalPoint.x)}%,{' '}
            {Math.round(focalPoint.y)}%
          </p>

          {/* Labels */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-text-muted">Hero Labels</h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(LABEL_INFO).map(([label, info]) => (
                <button
                  key={label}
                  onClick={() => toggleLabel(label)}
                  className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${
                    labels.includes(label)
                      ? 'border-accent bg-accent/10'
                      : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <span className="text-xl">{info.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {info.name}
                    </div>
                    <div className="text-xs text-text-dim truncate">
                      {info.description}
                    </div>
                  </div>
                  {labels.includes(label) && (
                    <CheckIcon size={16} className="text-accent shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Photo info */}
          <div className="text-sm text-text-muted space-y-1">
            {photo.event_name && <div>Event: {photo.event_name}</div>}
            {photo.band_name && <div>Band: {photo.band_name}</div>}
            {photo.photographer && (
              <div>Photographer: {photo.photographer}</div>
            )}
          </div>
        </div>

        {/* Right: Preview Panels */}
        <div className="lg:w-1/2 space-y-4">
          <h3 className="text-sm font-medium text-text-muted">Crop Previews</h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Desktop Hero (16:9 landscape) */}
            <CropPreview
              title="Desktop Hero"
              subtitle="Uses Y focal point"
              aspectRatio="16/9"
              imageUrl={photo.blob_url}
              focalPoint={focalPoint}
              objectPosition={`50% ${focalPoint.y}%`}
            />

            {/* Mobile Hero (9:16 portrait) */}
            <CropPreview
              title="Mobile Hero"
              subtitle="Uses X focal point"
              aspectRatio="9/16"
              imageUrl={photo.blob_url}
              focalPoint={focalPoint}
              objectPosition={`${focalPoint.x}% 50%`}
              maxHeight={180}
            />

            {/* Event Card (4:3) */}
            <CropPreview
              title="Event Card"
              subtitle="Uses both X & Y"
              aspectRatio="4/3"
              imageUrl={photo.blob_url}
              focalPoint={focalPoint}
              objectPosition={`${focalPoint.x}% ${focalPoint.y}%`}
            />

            {/* OG Image (1.91:1) */}
            <CropPreview
              title="Social Share"
              subtitle="OG Image 1200×630"
              aspectRatio="1.91/1"
              imageUrl={photo.blob_url}
              focalPoint={focalPoint}
              objectPosition={`${focalPoint.x}% ${focalPoint.y}%`}
            />

            {/* Square Thumbnail */}
            <CropPreview
              title="Thumbnail"
              subtitle="Gallery grid"
              aspectRatio="1/1"
              imageUrl={photo.blob_url}
              focalPoint={focalPoint}
              objectPosition={`${focalPoint.x}% ${focalPoint.y}%`}
            />

            {/* Band Page Hero (wider) */}
            <CropPreview
              title="Band Page"
              subtitle="70vh tall section"
              aspectRatio="21/9"
              imageUrl={photo.blob_url}
              focalPoint={focalPoint}
              objectPosition={`50% ${focalPoint.y}%`}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
        {error && <div className="text-error text-sm">{error}</div>}
        <div className="flex gap-3 ml-auto">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="accent" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <VinylSpinner size="xxs" className="mr-2" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
