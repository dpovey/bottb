'use client'

import { useState, useRef, useEffect } from 'react'
import { Photo, PHOTO_LABELS } from '@/lib/db-types'
import { Button, VinylSpinner, Modal } from '@/components/ui'
import { CheckIcon } from '@/components/icons'
import { CropPreview } from '@/components/photos/focal-point-editor'

// Label display info - exported for use in other components
export const HERO_LABEL_INFO = {
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

export type HeroLabelKey = keyof typeof HERO_LABEL_INFO

export interface HeroSettingsModalProps {
  isOpen: boolean
  photo: Photo
  onClose: () => void
  /** Called when changes are saved successfully */
  onSave?: (
    photoId: string,
    labels: string[],
    focalPoint: { x: number; y: number }
  ) => void
}

/**
 * Combined modal for editing hero labels and focal point.
 * Shows crop previews at various aspect ratios.
 * Has explicit Save/Cancel buttons.
 */
export function HeroSettingsModal({
  isOpen,
  photo,
  onClose,
  onSave,
}: HeroSettingsModalProps) {
  const [focalPoint, setFocalPoint] = useState(
    photo.hero_focal_point ?? { x: 50, y: 50 }
  )
  const [labels, setLabels] = useState<string[]>(photo.labels || [])
  const [isDragging, setIsDragging] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sourceImageRef = useRef<HTMLDivElement>(null)

  // Update state when photo changes
  useEffect(() => {
    setFocalPoint(photo.hero_focal_point ?? { x: 50, y: 50 })
    setLabels(photo.labels || [])
    setError(null)
  }, [photo])

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(true)
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(
      0,
      Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)
    )
    const y = Math.max(
      0,
      Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)
    )
    setFocalPoint({ x, y })
  }

  useEffect(() => {
    if (!isDragging) return

    const calculateFocalPoint = (e: MouseEvent, element: HTMLDivElement) => {
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
    }

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
  }, [isDragging])

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

      onSave?.(photo.id, labels, focalPoint)
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
      title="Hero Settings"
      size="xl"
      disabled={isSaving}
    >
      <div className="flex flex-col lg:flex-row gap-4 max-h-[60vh] overflow-y-auto">
        {/* Left: Source Image with Focal Point */}
        <div className="lg:w-1/2 space-y-3">
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
            className="relative aspect-[16/10] rounded-lg overflow-hidden cursor-crosshair select-none border border-white/10"
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

          <p className="text-xs text-text-dim text-center -mt-1">
            Click to set focal point: {Math.round(focalPoint.x)}%,{' '}
            {Math.round(focalPoint.y)}%
          </p>

          {/* Labels */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-medium text-text-muted">Hero Labels</h4>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(HERO_LABEL_INFO).map(([label, info]) => (
                <button
                  key={label}
                  onClick={() => toggleLabel(label)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all text-left ${
                    labels.includes(label)
                      ? 'border-accent bg-accent/10'
                      : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <span className="text-base">{info.icon}</span>
                  <span className="text-xs font-medium truncate flex-1">
                    {info.name}
                  </span>
                  {labels.includes(label) && (
                    <CheckIcon size={14} className="text-accent shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Preview Panels */}
        <div className="lg:w-1/2 space-y-2">
          <h3 className="text-xs font-medium text-text-muted">Crop Previews</h3>

          <div className="grid grid-cols-3 gap-2">
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
              maxHeight={100}
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

      {/* Footer - always visible */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10 bg-bg-elevated sticky bottom-0">
        {error && <div className="text-error text-sm">{error}</div>}
        <div className="flex gap-2 ml-auto">
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
