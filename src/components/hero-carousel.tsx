'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { useMounted } from '@/lib/hooks'

/**
 * Calculate the transform needed to center a focal point in a container.
 * Scale up the image and translate to ensure the focal point appears at center.
 */
function getFocalPointTransform(focalPoint?: { x: number; y: number }) {
  const x = focalPoint?.x ?? 50
  const y = focalPoint?.y ?? 50
  const translateX = (50 - x) * 0.5
  const translateY = (50 - y) * 0.5
  return `scale(1.2) translate(${translateX}%, ${translateY}%)`
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
            className={`absolute inset-0 overflow-hidden transition-opacity duration-1000 ${
              index === currentIndex && !isTransitioning
                ? 'opacity-100'
                : 'opacity-0'
            }`}
          >
            <Image
              src={image.url}
              alt="Battle of the Tech Bands event"
              fill
              className="object-cover origin-center"
              style={{
                transform: getFocalPointTransform(image.focalPoint),
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
