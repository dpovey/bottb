'use client'

import { useState, useEffect, useCallback } from 'react'
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
  /** Overlay style: 'heavy' for solid dark overlay (default), 'accent' for purple/indigo accents */
  overlay?: 'heavy' | 'accent'
  /** Height variant - matches Hero component sizes */
  size?: 'sm' | 'md' | 'lg' | 'full'
  /** Content alignment: 'center' (default, like Hero), 'end' (content at bottom) */
  align?: 'center' | 'end'
  /** Initial image index - pass from server to avoid flash on hydration */
  initialIndex?: number
}

export function HeroCarousel({
  images,
  interval = 10000,
  fallbackImage = DEFAULT_HERO_IMAGE.url,
  children,
  overlay = 'heavy',
  size = 'lg',
  align = 'center',
  initialIndex = 0,
}: HeroCarouselProps) {
  const effectiveImages = images.length > 0 ? images : [{ url: fallbackImage }]
  const mounted = useMounted()

  // Use server-provided initialIndex for consistent SSR/hydration (no flash)
  const safeInitialIndex =
    effectiveImages.length > 0 ? initialIndex % effectiveImages.length : 0
  const [currentIndex, setCurrentIndex] = useState(safeInitialIndex)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const nextImage = useCallback(() => {
    if (effectiveImages.length <= 1) return

    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % effectiveImages.length)
      setIsTransitioning(false)
    }, 500) // Half of the CSS transition duration
  }, [effectiveImages.length])

  // Start interval for cycling (no randomization needed - handled by server)
  useEffect(() => {
    if (!mounted || effectiveImages.length <= 1) return

    const timer = setInterval(nextImage, interval)
    return () => clearInterval(timer)
  }, [mounted, effectiveImages.length, interval, nextImage])

  const heightClass = {
    sm: 'min-h-[40vh]',
    md: 'min-h-[60vh]',
    lg: 'min-h-[80vh]',
    full: 'min-h-screen',
  }[size]

  const alignClass =
    align === 'center' ? 'items-center justify-center' : 'items-end'

  return (
    <section className={`relative ${heightClass} flex ${alignClass}`}>
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
          // Use blob_url (2000px) as default - sufficient for 1920px displays at 2x DPR
          // Let srcSet upgrade to 4K only when truly needed (saves ~1.8MB per image)
          const desktopSrc = image.blob_url || image.url

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
                sizes="(max-width: 640px) 100vw, (max-width: 1920px) 100vw, 1920px"
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
              {/* Uses 2000px by default - srcSet upgrades to 4K only for true 4K displays */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={desktopSrc}
                srcSet={srcSet}
                sizes="(max-width: 1920px) 100vw, 1920px"
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
        {overlay === 'heavy' ? (
          <>
            {/* Heavy overlay - matches Hero component style */}
            <div className="absolute inset-0 bg-bg/55" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-bg to-transparent" />
          </>
        ) : (
          <>
            {/* Accent overlay - purple/indigo color accent */}
            <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/70 to-bg/40" />
            <div className="absolute inset-0 bg-linear-to-r from-purple-900/30 via-transparent to-indigo-900/20" />
          </>
        )}
      </div>

      {/* Content */}
      {children}
    </section>
  )
}
