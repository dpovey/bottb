'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Modal } from '@/components/ui'
import { Photo, PHOTO_LABELS } from '@/lib/db'
import { SpinnerIcon, CheckIcon } from '@/components/icons'

// Label display info
const LABEL_INFO = {
  [PHOTO_LABELS.BAND_HERO]: {
    name: 'Band Hero',
    description: 'Featured on band page',
    icon: '🎸',
  },
  [PHOTO_LABELS.EVENT_HERO]: {
    name: 'Event Hero',
    description: 'Featured on event page',
    icon: '🎪',
  },
  [PHOTO_LABELS.GLOBAL_HERO]: {
    name: 'Global Hero',
    description: 'Featured on home page',
    icon: '🏠',
  },
} as const

interface HeroLabelsModalProps {
  isOpen: boolean
  photo: Photo
  onClose: () => void
  onLabelsUpdated: (photoId: string, labels: string[]) => void
  onFocalPointUpdated: (
    photoId: string,
    focalPoint: { x: number; y: number }
  ) => void
}

/**
 * Modal for managing hero labels and focal point on a photo.
 * Allows admins to set which pages a photo should be featured on.
 */
export function HeroLabelsModal({
  isOpen,
  photo,
  onClose,
  onLabelsUpdated,
  onFocalPointUpdated,
}: HeroLabelsModalProps) {
  const [labels, setLabels] = useState<string[]>([])
  const [focalPoint, setFocalPoint] = useState({ x: 50, y: 50 })
  const [isLoading, setIsLoading] = useState(false)
  const [isSavingLabels, setIsSavingLabels] = useState(false)
  const [isSavingFocalPoint, setIsSavingFocalPoint] = useState(false)
  const [isDraggingFocalPoint, setIsDraggingFocalPoint] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const focalPointPreviewRef = useRef<HTMLDivElement>(null)

  // Fetch labels when modal opens
  useEffect(() => {
    if (!isOpen || !photo) return

    const fetchLabels = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/photos/${photo.id}/labels`)
        if (!response.ok) throw new Error('Failed to fetch labels')
        const data = await response.json()
        setLabels(data.labels || [])
        setFocalPoint(data.heroFocalPoint || { x: 50, y: 50 })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load labels')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLabels()
  }, [isOpen, photo])

  // Calculate focal point from mouse event
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

  // Handle focal point drag start
  const handleFocalPointMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDraggingFocalPoint(true)
      const newPoint = calculateFocalPoint(e, e.currentTarget)
      setFocalPoint(newPoint)
    },
    [calculateFocalPoint]
  )

  // Handle focal point drag
  useEffect(() => {
    if (!isDraggingFocalPoint) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!focalPointPreviewRef.current) return
      const newPoint = calculateFocalPoint(e, focalPointPreviewRef.current)
      setFocalPoint(newPoint)
    }

    const handleMouseUp = () => {
      setIsDraggingFocalPoint(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingFocalPoint, calculateFocalPoint])

  // Toggle a label
  const handleToggleLabel = async (label: string) => {
    const newLabels = labels.includes(label)
      ? labels.filter((l) => l !== label)
      : [...labels, label]

    setIsSavingLabels(true)
    setError(null)

    try {
      const response = await fetch(`/api/photos/${photo.id}/labels`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels: newLabels }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update labels')
      }

      const result = await response.json()
      setLabels(result.labels)
      onLabelsUpdated(photo.id, result.labels)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSavingLabels(false)
    }
  }

  // Save focal point
  const handleSaveFocalPoint = async () => {
    setIsSavingFocalPoint(true)
    setError(null)

    try {
      const response = await fetch(`/api/photos/${photo.id}/labels`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroFocalPoint: focalPoint }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save focal point')
      }

      const result = await response.json()
      setFocalPoint(result.heroFocalPoint)
      onFocalPointUpdated(photo.id, result.heroFocalPoint)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save focal point'
      )
    } finally {
      setIsSavingFocalPoint(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hero Settings"
      description="Select where this photo should be featured and set the focal point for hero displays."
      size="lg"
      disabled={isSavingLabels || isSavingFocalPoint}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <SpinnerIcon size={32} className="animate-spin text-text-muted" />
        </div>
      ) : (
        <div className="space-y-6">
          {error && (
            <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
              {error}
            </div>
          )}

          {/* Hero Labels */}
          <div>
            <h4 className="text-sm font-medium text-text-muted mb-3">
              Hero Labels
            </h4>
            <div className="space-y-2">
              {Object.entries(LABEL_INFO).map(([label, info]) => (
                <button
                  key={label}
                  onClick={() => handleToggleLabel(label)}
                  disabled={isSavingLabels}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    labels.includes(label)
                      ? 'border-accent bg-accent/10'
                      : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <span className="text-2xl">{info.icon}</span>
                  <div className="flex-1 text-left">
                    <span className="font-medium">{info.name}</span>
                    <span className="text-sm text-text-muted block">
                      {info.description}
                    </span>
                  </div>
                  {labels.includes(label) && (
                    <CheckIcon size={20} className="text-accent" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Focal Point Editor */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-text-muted">
                Hero Focal Point
              </h4>
              <button
                onClick={handleSaveFocalPoint}
                disabled={isSavingFocalPoint}
                className="text-sm px-3 py-1.5 bg-accent hover:bg-accent-light rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingFocalPoint && (
                  <SpinnerIcon size={14} className="animate-spin" />
                )}
                Save Point
              </button>
            </div>
            <p className="text-sm text-text-muted mb-3">
              Click and drag to set the focal point. This determines which part
              of the image stays visible when cropped for hero displays.
            </p>
            <div
              ref={focalPointPreviewRef}
              className="relative aspect-[16/9] rounded-lg overflow-hidden cursor-crosshair select-none"
              onMouseDown={handleFocalPointMouseDown}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.blob_url}
                alt="Focal point preview"
                className="w-full h-full object-cover"
                draggable={false}
              />
              {/* Focal point indicator */}
              <div
                className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: `${focalPoint.x}%`, top: `${focalPoint.y}%` }}
              >
                <div className="absolute inset-0 border-2 border-white rounded-full shadow-lg" />
                <div className="absolute inset-[6px] bg-accent rounded-full" />
              </div>
              {/* Grid overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="border border-white/20" />
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-text-dim mt-2 text-center">
              Current: {Math.round(focalPoint.x)}%, {Math.round(focalPoint.y)}%
            </p>
          </div>
        </div>
      )}
    </Modal>
  )
}
