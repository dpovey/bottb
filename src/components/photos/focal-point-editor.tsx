'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { VinylSpinner } from '@/components/ui'

export interface FocalPoint {
  x: number
  y: number
}

// ============================================================================
// CropPreview - Shows how an image crops at different aspect ratios
// ============================================================================

interface CropPreviewProps {
  title: string
  subtitle: string
  aspectRatio: string
  imageUrl: string
  focalPoint: FocalPoint
  objectPosition: string
  /** Optional max height for tall aspect ratios (e.g., mobile portrait) */
  maxHeight?: number
}

export function CropPreview({
  title,
  subtitle,
  aspectRatio,
  imageUrl,
  focalPoint,
  objectPosition,
  maxHeight,
}: CropPreviewProps) {
  // Parse aspect ratio to calculate dimensions when maxHeight is set
  const [w, h] = aspectRatio.split('/').map(Number)

  // For portrait aspect ratios with maxHeight, calculate the width
  const style: React.CSSProperties = maxHeight
    ? {
        height: maxHeight,
        width: (maxHeight * w) / h,
      }
    : { aspectRatio }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{title}</span>
        <span className="text-xs text-text-dim">{subtitle}</span>
      </div>
      <div
        className={`relative rounded-lg overflow-hidden border border-white/10 bg-black/50 ${
          maxHeight ? 'mx-auto' : ''
        }`}
        style={style}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover"
          style={{ objectPosition }}
        />
        {/* Small focal point indicator */}
        <div
          className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${focalPoint.x}%`, top: `${focalPoint.y}%` }}
        >
          <div className="absolute inset-0 border border-white/50 rounded-full" />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// FocalPointEditor - Interactive focal point picker with crop previews
// ============================================================================

interface FocalPointEditorProps {
  imageUrl: string
  initialFocalPoint?: FocalPoint
  onSave: (focalPoint: FocalPoint) => Promise<void>
  /** Optional photo dimensions */
  width?: number
  height?: number
  /** Optional: Show save button (default true) */
  showSaveButton?: boolean
  /** Optional: Callback when focal point changes (for live preview) */
  onFocalPointChange?: (focalPoint: FocalPoint) => void
}

export function FocalPointEditor({
  imageUrl,
  initialFocalPoint = { x: 50, y: 50 },
  onSave,
  width = 0,
  height = 0,
  showSaveButton = true,
  onFocalPointChange,
}: FocalPointEditorProps) {
  const [focalPoint, setFocalPoint] = useState<FocalPoint>(initialFocalPoint)
  const [isDragging, setIsDragging] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sourceImageRef = useRef<HTMLDivElement>(null)

  // Update state when initial focal point changes
  useEffect(() => {
    setFocalPoint(initialFocalPoint)
  }, [initialFocalPoint])

  // Notify parent of changes
  useEffect(() => {
    onFocalPointChange?.(focalPoint)
  }, [focalPoint, onFocalPointChange])

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
      await onSave(focalPoint)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  // Get resolution info
  const hasHighRes = width >= 2000 || height >= 2000
  const has4K = width >= 4000 || height >= 4000

  return (
    <div className="flex flex-col lg:flex-row gap-6">
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
            ) : width > 0 ? (
              <span className="px-2 py-0.5 rounded bg-warning/20 text-warning">
                Low Res
              </span>
            ) : null}
          </div>
        </div>

        <div
          ref={sourceImageRef}
          className="relative aspect-[4/3] rounded-lg overflow-hidden cursor-crosshair select-none border border-white/10"
          onMouseDown={handleMouseDown}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
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

        {error && (
          <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
            {error}
          </div>
        )}

        {showSaveButton && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-accent hover:bg-accent-light px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <VinylSpinner size="xxs" />
                Saving...
              </>
            ) : (
              'Save Focal Point'
            )}
          </button>
        )}
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
            imageUrl={imageUrl}
            focalPoint={focalPoint}
            objectPosition={`50% ${focalPoint.y}%`}
          />

          {/* Mobile Hero (9:16 portrait) */}
          <CropPreview
            title="Mobile Hero"
            subtitle="Uses X focal point"
            aspectRatio="9/16"
            imageUrl={imageUrl}
            focalPoint={focalPoint}
            objectPosition={`${focalPoint.x}% 50%`}
            maxHeight={180}
          />

          {/* Event Card (4:3) */}
          <CropPreview
            title="Event Card"
            subtitle="Uses both X & Y"
            aspectRatio="4/3"
            imageUrl={imageUrl}
            focalPoint={focalPoint}
            objectPosition={`${focalPoint.x}% ${focalPoint.y}%`}
          />

          {/* OG Image (1.91:1) */}
          <CropPreview
            title="Social Share"
            subtitle="OG Image 1200×630"
            aspectRatio="1.91/1"
            imageUrl={imageUrl}
            focalPoint={focalPoint}
            objectPosition={`${focalPoint.x}% ${focalPoint.y}%`}
          />

          {/* Square Thumbnail */}
          <CropPreview
            title="Thumbnail"
            subtitle="Gallery grid"
            aspectRatio="1/1"
            imageUrl={imageUrl}
            focalPoint={focalPoint}
            objectPosition={`${focalPoint.x}% ${focalPoint.y}%`}
          />

          {/* Band Page Hero (wider) */}
          <CropPreview
            title="Band Page"
            subtitle="70vh tall section"
            aspectRatio="21/9"
            imageUrl={imageUrl}
            focalPoint={focalPoint}
            objectPosition={`50% ${focalPoint.y}%`}
          />
        </div>
      </div>
    </div>
  )
}
