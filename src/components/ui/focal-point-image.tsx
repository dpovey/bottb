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
  // Calculate the translation needed to center the focal point
  // - If focal point is 45%, we need to shift right by (50-45)*0.5 = 2.5%
  // - The 0.5 factor accounts for the 1.2x scale
  const translateX = (50 - focalPoint.x) * 0.5
  const translateY = (50 - focalPoint.y) * 0.5

  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover origin-center"
        style={{
          // Scale up slightly and translate to center the focal point
          transform: `scale(1.2) translate(${translateX}%, ${translateY}%)`,
        }}
        priority={priority}
        sizes={sizes}
        unoptimized={unoptimized}
      />
    </div>
  )
}
