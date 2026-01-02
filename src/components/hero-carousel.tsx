'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useMounted } from '@/lib/hooks'
import { DEFAULT_HERO_IMAGE } from '@/lib/stock-images'
import { buildHeroSrcSet, type PhotoImageUrls } from '@/lib/photo-srcset'

/**
 * Get object-position for mobile (portrait) - horizontal cropping.
 * Uses focal X, centers Y.
 */
function getMobileObjectPosition(focalPoint?: { x: number; y: number }) {
  return `${focalPoint?.x ?? 50}% 50%`
}

/**
 * Get object-position for desktop (landscape) - vertical cropping.
 * Centers X, uses focal Y.
 */
function getDesktopObjectPosition(focalPoint?: { x: number; y: number }) {
  return `50% ${focalPoint?.y ?? 50}%`
}

interface HeroImage extends Partial<PhotoImageUrls> {
  url: string
  /** High-resolution URL (e.g., 4K version) for large displays */
  urlHigh?: string
  focalPoint?: { x: number; y: number }
}

interface HeroCarouselProps {
  images: HeroImage[]
  interval?: number // in milliseconds
  fallbackImage?: string
  children?: React.ReactNode
}

export function HeroCarousel({
  images,
  interval = 10000,
  fallbackImage = DEFAULT_HERO_IMAGE.url,
  children,
}: HeroCarouselProps) {
  const effectiveImages = images.length > 0 ? images : [{ url: fallbackImage }]
  const mounted = useMounted()
  const initializedRef = useRef(false)

  // Start with index 0 for consistent SSR/hydration
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const nextImage = useCallback(() => {
    if (effectiveImages.length <= 1) return

    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % effectiveImages.length)
      setIsTransitioning(false)
    }, 500) // Half of the CSS transition duration
  }, [effectiveImages.length])

  // Randomize starting image on mount and start interval
  useEffect(() => {
    if (!mounted || effectiveImages.length <= 1) return

    // Randomize on first mount only - use setTimeout to defer setState
    if (!initializedRef.current) {
      initializedRef.current = true
      const randomIndex = Math.floor(Math.random() * effectiveImages.length)
      setTimeout(() => setCurrentIndex(randomIndex), 0)
    }

    const timer = setInterval(nextImage, interval)
    return () => clearInterval(timer)
  }, [mounted, effectiveImages.length, interval, nextImage])

  return (
    <section className="relative min-h-[70vh] flex items-end">
      {/* Background Images with crossfade */}
      <div className="absolute inset-0">
        {effectiveImages.map((image, index) => {
          // Build srcset if photo URLs available
          const srcSet =
            image.blob_url || image.medium_url || image.large_4k_url
              ? buildHeroSrcSet({
                  blob_url: image.blob_url || image.url,
                  medium_url: image.medium_url,
                  large_4k_url: image.large_4k_url,
                })
              : undefined

          const isCurrent = index === currentIndex
          const desktopSrc = image.urlHigh || image.large_4k_url || image.url

          return (
            <div
              key={image.url}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                isCurrent && !isTransitioning ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {/* Mobile: horizontal cropping, use focal X */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                srcSet={srcSet}
                sizes="100vw"
                alt="Battle of the Tech Bands event"
                className="absolute inset-0 w-full h-full object-cover md:hidden"
                style={{
                  objectPosition: getMobileObjectPosition(image.focalPoint),
                }}
                fetchPriority={isCurrent ? 'high' : 'auto'}
                loading={isCurrent ? 'eager' : 'lazy'}
                decoding={isCurrent ? 'sync' : 'async'}
              />
              {/* Desktop: vertical cropping, use focal Y */}
              {/* Uses high-res source when available for better quality on large displays */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={desktopSrc}
                srcSet={srcSet}
                sizes="100vw"
                alt="Battle of the Tech Bands event"
                className="absolute inset-0 w-full h-full object-cover hidden md:block"
                style={{
                  objectPosition: getDesktopObjectPosition(image.focalPoint),
                }}
                fetchPriority={isCurrent ? 'high' : 'auto'}
                loading={isCurrent ? 'eager' : 'lazy'}
                decoding={isCurrent ? 'sync' : 'async'}
              />
            </div>
          )
        })}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/70 to-bg/40" />
        <div className="absolute inset-0 bg-linear-to-r from-purple-900/30 via-transparent to-indigo-900/20" />
      </div>

      {/* Content */}
      {children}
    </section>
  )
}
