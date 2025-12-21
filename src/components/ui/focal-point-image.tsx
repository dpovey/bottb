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
   * Controls which part of the image stays visible when cropped.
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
 * An image component that uses focal point for smart cropping.
 *
 * Key insight: with object-fit: cover, cropping only happens in ONE dimension:
 * - Wide container (landscape): image cropped vertically → only Y focal point matters
 * - Tall container (portrait): image cropped horizontally → only X focal point matters
 *
 * We use object-position with the focal point for the cropped dimension,
 * and 50% (centered) for the non-cropped dimension. No scaling needed!
 *
 * Uses responsive breakpoints: mobile (portrait) vs md+ (landscape).
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
  return (
    <div className={cn('absolute inset-0', className)}>
      {/* Mobile/Portrait: horizontal cropping, use focal X, center Y */}
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover md:hidden"
        style={{ objectPosition: `${focalPoint.x}% 50%` }}
        priority={priority}
        fetchPriority={priority ? 'high' : 'auto'}
        sizes={sizes}
        unoptimized={unoptimized}
      />
      {/* Desktop/Landscape: vertical cropping, center X, use focal Y */}
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover hidden md:block"
        style={{ objectPosition: `50% ${focalPoint.y}%` }}
        priority={priority}
        fetchPriority={priority ? 'high' : 'auto'}
        sizes={sizes}
        unoptimized={unoptimized}
      />
    </div>
  )
}
