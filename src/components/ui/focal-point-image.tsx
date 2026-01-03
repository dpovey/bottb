'use client'

import { cn } from '@/lib/utils'
import { buildHeroSrcSet, type PhotoImageUrls } from '@/lib/photo-srcset'

export interface FocalPoint {
  x: number // 0-100 percentage from left
  y: number // 0-100 percentage from top
}

export interface FocalPointImageProps {
  src: string
  alt: string
  /**
   * Optional high-resolution source (e.g., 4K version).
   * When provided, used for desktop displays for better quality on large screens.
   * @deprecated Use photoUrls instead for full srcset support
   */
  srcHigh?: string
  /**
   * Optional photo URLs for responsive srcset.
   * Includes medium_url (1200px), blob_url (2000px), large_4k_url (4000px).
   */
  photoUrls?: PhotoImageUrls
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
 *
 * When photoUrls is provided, builds a responsive srcset with medium/large/4K variants.
 * Falls back to srcHigh for desktop when photoUrls is not available.
 */
export function FocalPointImage({
  src,
  srcHigh,
  photoUrls,
  alt,
  focalPoint = { x: 50, y: 50 },
  priority = false,
  sizes = '(max-width: 1920px) 100vw, 1920px',
  className,
}: FocalPointImageProps) {
  // Build srcset if photoUrls available
  const srcSet = photoUrls ? buildHeroSrcSet(photoUrls) : undefined

  // Use blob_url (2000px) as default - sufficient for 1920px displays at 2x DPR
  // srcSet will upgrade to 4K only when sizes indicates need for larger
  // Fall back to srcHigh for backwards compat when photoUrls not available
  const desktopSrc = photoUrls?.blob_url || srcHigh || src

  return (
    <div className={cn('absolute inset-0', className)}>
      {/* Mobile/Portrait: horizontal cropping, use focal X, center Y */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover md:hidden"
        style={{ objectPosition: `${focalPoint.x}% 50%` }}
        fetchPriority={priority ? 'high' : 'auto'}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
      />
      {/* Desktop/Landscape: vertical cropping, center X, use focal Y */}
      {/* Uses 2000px by default - srcSet upgrades to 4K only for true 4K displays */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={desktopSrc}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover hidden md:block"
        style={{ objectPosition: `50% ${focalPoint.y}%` }}
        fetchPriority={priority ? 'high' : 'auto'}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
      />
    </div>
  )
}
