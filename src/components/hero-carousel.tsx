'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { useMounted } from '@/lib/hooks'

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

interface HeroImage {
  url: string
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
  fallbackImage = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1920&q=80',
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
        {effectiveImages.map((image, index) => (
          <div
            key={image.url}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentIndex && !isTransitioning
                ? 'opacity-100'
                : 'opacity-0'
            }`}
          >
            {/* Mobile: horizontal cropping, use focal X */}
            <Image
              src={image.url}
              alt="Battle of the Tech Bands event"
              fill
              className="object-cover md:hidden"
              style={{
                objectPosition: getMobileObjectPosition(image.focalPoint),
              }}
              sizes="100vw"
              priority={index === currentIndex}
            />
            {/* Desktop: vertical cropping, use focal Y */}
            <Image
              src={image.url}
              alt="Battle of the Tech Bands event"
              fill
              className="object-cover hidden md:block"
              style={{
                objectPosition: getDesktopObjectPosition(image.focalPoint),
              }}
              sizes="100vw"
              priority={index === currentIndex}
            />
          </div>
        ))}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/70 to-bg/40" />
        <div className="absolute inset-0 bg-linear-to-r from-purple-900/30 via-transparent to-indigo-900/20" />
      </div>

      {/* Content */}
      {children}
    </section>
  )
}
