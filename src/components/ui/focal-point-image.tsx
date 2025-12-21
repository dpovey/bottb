'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

export interface FocalPoint {
  x: number // 0-100 percentage from left
  y: number // 0-100 percentage from top
}

export interface FocalPointImageProps {
  src: string
  alt: string
  /**
   * Focal point coordinates (0-100 for both x and y).
   * The focal point will be centered in the container.
   */
  focalPoint?: FocalPoint
  /** Whether this is a priority image (above the fold) */
  priority?: boolean
  /** Image sizes attribute for responsive loading */
  sizes?: string
  /** Additional className for the container */
  className?: string
  /** Whether to skip image optimization (for blob URLs) */
  unoptimized?: boolean
}

/**
 * An image component that centers a focal point in the container.
 *
 * Unlike simple `object-position`, which aligns the focal point percentage
 * with the same percentage of the container, this component ensures the
 * focal point appears at the CENTER of the container regardless of its
 * position in the image.
 *
 * This is especially important on mobile where heavy cropping can cause
 * the focal point to appear off-center with naive object-position usage.
 */
export function FocalPointImage({
  src,
  alt,
  focalPoint = { x: 50, y: 50 },
  priority = false,
  sizes = '100vw',
  className,
  unoptimized = false,
}: FocalPointImageProps) {
  // Calculate how far the focal point is from center
  const deltaX = Math.abs(50 - focalPoint.x)
  const deltaY = Math.abs(50 - focalPoint.y)
  const maxDelta = Math.max(deltaX, deltaY)

  // Dynamic scale: only zoom as much as needed
  // - Focal point at 50% (center) = scale 1.0 (no zoom)
  // - Focal point at 0% or 100% (edge) = scale ~1.15
  // Add small buffer (1.02) to prevent edge gaps
  const scale = 1.02 + maxDelta * 0.003

  // Translation factor adjusts based on scale
  const translateFactor = 1 / scale
  const translateX = (50 - focalPoint.x) * translateFactor
  const translateY = (50 - focalPoint.y) * translateFactor

  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover origin-center"
        style={{
          transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
        }}
        priority={priority}
        sizes={sizes}
        unoptimized={unoptimized}
      />
    </div>
  )
}
