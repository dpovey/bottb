'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Photo, PHOTO_LABELS } from '@/lib/db-types'
import {
  HeroSettingsModal,
  HERO_LABEL_INFO,
  HeroLabelKey,
} from '@/components/photos/hero-settings-modal'

interface HeroAdminClientProps {
  initialPhotos: Photo[]
  events: { id: string; name: string }[]
  bandsMap: Record<string, { id: string; name: string }[]>
}

export function HeroAdminClient({
  initialPhotos,
  events,
  bandsMap: _bandsMap,
}: HeroAdminClientProps) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [filterLabel, setFilterLabel] = useState<string>('')
  const [filterEvent, setFilterEvent] = useState<string>('')
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

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
    setShowSettingsModal(true)
  }

  const handleSave = (
    photoId: string,
    labels: string[],
    focalPoint: { x: number; y: number }
  ) => {
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photoId ? { ...p, labels, hero_focal_point: focalPoint } : p
      )
    )
    if (selectedPhoto?.id === photoId) {
      setSelectedPhoto((prev) =>
        prev ? { ...prev, labels, hero_focal_point: focalPoint } : null
      )
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
            {Object.entries(HERO_LABEL_INFO).map(([key, info]) => (
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
        {Object.entries(HERO_LABEL_INFO).map(([key, info]) => (
          <div
            key={key}
            className={`p-4 rounded-xl border ${info.color} cursor-pointer transition-all hover:scale-[1.02]`}
            onClick={() => setFilterLabel(filterLabel === key ? '' : key)}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{info.icon}</span>
              <div>
                <div className="text-2xl font-bold">
                  {photosByLabel[key as HeroLabelKey]?.length || 0}
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
          label={filterLabel as HeroLabelKey}
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
                label={label as HeroLabelKey}
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

      {/* Settings Modal */}
      {selectedPhoto && (
        <HeroSettingsModal
          isOpen={showSettingsModal}
          photo={selectedPhoto}
          onClose={() => {
            setShowSettingsModal(false)
            setSelectedPhoto(null)
          }}
          onSave={handleSave}
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
  label: HeroLabelKey
  photos: Photo[]
  onPhotoClick: (photo: Photo) => void
}) {
  const info = HERO_LABEL_INFO[label]
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
              const labelInfo = HERO_LABEL_INFO[label as HeroLabelKey]
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
