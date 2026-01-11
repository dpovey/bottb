'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useMounted } from '@/lib/hooks'
import { FocalPointImage } from './focal-point-image'
import type { HeroImage } from './hero-utils'

interface HeroBackgroundProps {
  /** Array of photos to cycle through. If single photo, no animation. */
  photos: HeroImage[]
  /** Fallback image URL when no photos available */
  fallbackImageUrl?: string
  /** Alt text for images */
  alt: string
  /** Interval between image transitions in ms (default: 8000) */
  interval?: number
}

/**
 * A hero background component that supports multiple images with crossfade.
 * Used by event, band, and photographer pages for their hero sections.
 *
 * When photos array has:
 * - 0 items: Shows gradient fallback or fallbackImageUrl
 * - 1 item: Shows single image (no animation)
 * - 2+ items: Crossfades between images at interval
 */
export function HeroBackground({
  photos,
  fallbackImageUrl,
  alt,
  interval = 8000,
}: HeroBackgroundProps) {
  const mounted = useMounted()
  const initializedRef = useRef(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Randomize starting image and set up interval for multiple photos
  useEffect(() => {
    if (!mounted || photos.length <= 1) return

    if (!initializedRef.current) {
      initializedRef.current = true
      const randomIndex = Math.floor(Math.random() * photos.length)
      setTimeout(() => setCurrentIndex(randomIndex), 0)
    }

    const nextImage = () => {
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % photos.length)
        setIsTransitioning(false)
      }, 500)
    }

    const timer = setInterval(nextImage, interval)
    return () => clearInterval(timer)
  }, [mounted, photos.length, interval])

  // No photos - show gradient or fallback image
  if (photos.length === 0) {
    if (fallbackImageUrl) {
      return (
        <div className="absolute inset-0">
          <Image
            src={fallbackImageUrl}
            alt={alt}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        </div>
      )
    }
    return (
      <div className="absolute inset-0 bg-linear-to-br from-bg-surface to-bg" />
    )
  }

  // Single photo - no animation needed
  if (photos.length === 1) {
    const photo = photos[0]
    return (
      <FocalPointImage
        src={photo.blob_url}
        srcHigh={photo.large_4k_url ?? undefined}
        alt={alt}
        focalPoint={photo.hero_focal_point}
        sizes="100vw"
        priority
      />
    )
  }

  // Multiple photos - crossfade animation
  return (
    <div className="absolute inset-0">
      {photos.map((photo, index) => {
        const isCurrent = index === currentIndex

        return (
          <div
            key={photo.blob_url}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              isCurrent && !isTransitioning ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <FocalPointImage
              src={photo.blob_url}
              srcHigh={photo.large_4k_url ?? undefined}
              alt={alt}
              focalPoint={photo.hero_focal_point}
              sizes="100vw"
              priority={isCurrent}
            />
          </div>
        )
      })}
    </div>
  )
}
