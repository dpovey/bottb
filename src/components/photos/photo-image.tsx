'use client'

import { memo } from 'react'
import { Photo } from '@/lib/db-types'
import { buildThumbnailSrcSet, getBestThumbnailSrc } from '@/lib/photo-srcset'

/**
 * Shared photo display component that handles focal point positioning consistently.
 *
 * This component ensures all photo displays (gallery, slideshow, strips, cards, etc.)
 * use the same focal point logic for cropping. The focal point is applied via
 * CSS object-position, which works with object-fit: cover to crop images
 * while keeping the focal point visible.
 *
 * Usage:
 * - For thumbnails in grids: variant="thumbnail"
 * - For slideshows/full view: variant="full"
 * - For hero sections: variant="hero"
 */

export type PhotoImageVariant = 'thumbnail' | 'full' | 'hero'

export interface PhotoImageProps {
  /** The photo object containing URLs and focal point */
  photo: Photo
  /** Which image variant to use */
  variant?: PhotoImageVariant
  /** Alt text (defaults to original_filename) */
  alt?: string
  /** Additional CSS classes for the img element */
  className?: string
  /** Whether to use lazy loading (default: true for thumbnails, false for full) */
  loading?: 'lazy' | 'eager'
  /** Sizes attribute for responsive images */
  sizes?: string
  /** Whether to apply object-fit: cover (default: true) */
  cover?: boolean
  /** Optional callback when image loads */
  onLoad?: () => void
  /** Optional callback when image errors */
  onError?: () => void
  /** Whether the image is draggable (default: false) */
  draggable?: boolean
  /** Optional style overrides */
  style?: React.CSSProperties
}

/**
 * Get the focal point from a photo, defaulting to center (50%, 50%)
 */
export function getPhotoFocalPoint(photo: Photo): { x: number; y: number } {
  return photo.hero_focal_point ?? { x: 50, y: 50 }
}

/**
 * Get the object-position CSS value for a photo's focal point
 */
export function getPhotoObjectPosition(photo: Photo): string {
  const focalPoint = getPhotoFocalPoint(photo)
  return `${focalPoint.x}% ${focalPoint.y}%`
}

/**
 * PhotoImage - Shared component for displaying photos with focal point support
 *
 * Automatically applies the photo's focal point for smart cropping.
 * Use this component anywhere a photo needs to be displayed to ensure
 * consistent focal point behavior.
 */
export const PhotoImage = memo(function PhotoImage({
  photo,
  variant = 'thumbnail',
  alt,
  className = '',
  loading,
  sizes,
  cover = true,
  onLoad,
  onError,
  draggable = false,
  style,
}: PhotoImageProps) {
  // Determine image source based on variant
  const src = getImageSrc(photo, variant)
  const srcSet =
    variant === 'thumbnail' ? buildThumbnailSrcSet(photo) : undefined

  // Get focal point for object-position
  const objectPosition = getPhotoObjectPosition(photo)

  // Default sizes based on variant
  const defaultSizes =
    variant === 'thumbnail'
      ? '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'
      : '100vw'

  // Default loading based on variant
  const defaultLoading = variant === 'thumbnail' ? 'lazy' : 'eager'

  // Build class string
  const imgClass = cover ? `object-cover ${className}` : className

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes ?? defaultSizes}
      alt={alt ?? photo.original_filename ?? 'Photo'}
      className={imgClass}
      style={{
        objectPosition: cover ? objectPosition : undefined,
        ...style,
      }}
      loading={loading ?? defaultLoading}
      onLoad={onLoad}
      onError={onError}
      draggable={draggable}
    />
  )
})

/**
 * Get the appropriate image source URL based on variant
 */
function getImageSrc(photo: Photo, variant: PhotoImageVariant): string {
  switch (variant) {
    case 'thumbnail':
      return getBestThumbnailSrc(photo)
    case 'full':
      // Prefer 4K if available, otherwise large, otherwise blob_url
      return photo.large_4k_url || photo.medium_url || photo.blob_url
    case 'hero':
      // For hero images, use the largest available
      return photo.large_4k_url || photo.blob_url
    default:
      return getBestThumbnailSrc(photo)
  }
}

/**
 * Hook to get photo image props for use in custom img elements
 * Useful when you can't use the PhotoImage component directly
 */
export function usePhotoImageProps(
  photo: Photo,
  variant: PhotoImageVariant = 'thumbnail'
) {
  return {
    src: getImageSrc(photo, variant),
    srcSet: variant === 'thumbnail' ? buildThumbnailSrcSet(photo) : undefined,
    objectPosition: getPhotoObjectPosition(photo),
    focalPoint: getPhotoFocalPoint(photo),
  }
}
