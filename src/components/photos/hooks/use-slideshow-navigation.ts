'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { EmblaCarouselType } from 'embla-carousel'

interface UseSlideshowNavigationOptions {
  initialIndex: number
  totalItems: number
  isPlaying: boolean
  onPlayStop: () => void
}

interface UseSlideshowNavigationReturn {
  currentIndex: number
  setCurrentIndex: (index: number) => void
  slidesInView: number[]
  goToIndex: (index: number) => void
  goToNext: () => void
  goToPrevious: () => void
  setupEmblaListeners: (emblaApi: EmblaCarouselType) => () => void
  handleReInit: (emblaApi: EmblaCarouselType, newLength: number) => void
}

/**
 * Custom hook for managing slideshow navigation state and Embla carousel integration.
 * Handles keyboard navigation, slide tracking, and lazy loading coordination.
 */
export function useSlideshowNavigation({
  initialIndex,
  totalItems,
  isPlaying,
  onPlayStop,
}: UseSlideshowNavigationOptions): UseSlideshowNavigationReturn {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [slidesInView, setSlidesInView] = useState<number[]>([initialIndex])
  const emblaApiRef = useRef<EmblaCarouselType | null>(null)
  const currentIndexRef = useRef(currentIndex)
  const onPlayStopRef = useRef(onPlayStop)
  const updateSlidesInViewRef = useRef<
    ((emblaApi: EmblaCarouselType) => void) | null
  >(null)

  // Sync refs in effects (React compiler requires this)
  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  useEffect(() => {
    onPlayStopRef.current = onPlayStop
  }, [onPlayStop])

  // Navigate to specific index
  const goToIndex = useCallback((index: number) => {
    if (!emblaApiRef.current) return
    if (index === emblaApiRef.current.selectedScrollSnap()) return
    emblaApiRef.current.scrollTo(index)
  }, [])

  const goToNext = useCallback(() => {
    if (!emblaApiRef.current) return
    const current = emblaApiRef.current.selectedScrollSnap()
    const canGoNext =
      current < totalItems - 1 || (isPlaying && current === totalItems - 1)

    if (!canGoNext) return

    const nextIndex = current === totalItems - 1 ? 0 : current + 1
    emblaApiRef.current.scrollTo(nextIndex)
  }, [totalItems, isPlaying])

  const goToPrevious = useCallback(() => {
    if (!emblaApiRef.current) return
    if (!emblaApiRef.current.canScrollPrev()) return
    emblaApiRef.current.scrollPrev()
  }, [])

  // Update slides in view for lazy loading
  const updateSlidesInView = useCallback((emblaApi: EmblaCarouselType) => {
    setSlidesInView((prevSlidesInView) => {
      // Once all slides are loaded, stop listening
      if (prevSlidesInView.length === emblaApi.slideNodes().length) {
        if (updateSlidesInViewRef.current) {
          emblaApi.off('slidesInView', updateSlidesInViewRef.current)
        }
      }
      // Add newly visible slides to the list
      const inView = emblaApi
        .slidesInView()
        .filter((index: number) => !prevSlidesInView.includes(index))
      return prevSlidesInView.concat(inView)
    })
  }, [])

  // Keep the updateSlidesInView ref in sync
  useEffect(() => {
    updateSlidesInViewRef.current = updateSlidesInView
  }, [updateSlidesInView])

  // Setup Embla event listeners
  const setupEmblaListeners = useCallback(
    (emblaApi: EmblaCarouselType) => {
      emblaApiRef.current = emblaApi

      const onSelect = () => {
        const index = emblaApi.selectedScrollSnap()
        const current = currentIndexRef.current
        if (index !== current) {
          setCurrentIndex(index)
        }
      }

      // Stop play on any user interaction (swipe/drag)
      const onPointerDown = () => {
        onPlayStopRef.current()
      }

      // Initialize state on mount
      onSelect()
      updateSlidesInView(emblaApi)

      // Listen for all selection changes
      emblaApi
        .on('select', onSelect)
        .on('reInit', onSelect)
        .on('pointerDown', onPointerDown)
        .on('slidesInView', updateSlidesInView)

      // Return cleanup function
      return () => {
        emblaApi
          .off('select', onSelect)
          .off('reInit', onSelect)
          .off('pointerDown', onPointerDown)
          .off('slidesInView', updateSlidesInView)
      }
    },
    [updateSlidesInView]
  )

  // Handle re-initialization when photos array changes
  const handleReInit = useCallback(
    (emblaApi: EmblaCarouselType, newLength: number) => {
      const currentPos = emblaApi.selectedScrollSnap()
      emblaApi.reInit()
      if (currentPos < newLength) {
        emblaApi.scrollTo(currentPos, true)
      }
    },
    []
  )

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        onPlayStopRef.current()
        goToNext()
      }
      if (e.key === 'ArrowLeft') {
        onPlayStopRef.current()
        goToPrevious()
      }
      if (e.key === ' ') {
        e.preventDefault()
        // Toggle play handled externally
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToNext, goToPrevious])

  return {
    currentIndex,
    setCurrentIndex,
    slidesInView,
    goToIndex,
    goToNext,
    goToPrevious,
    setupEmblaListeners,
    handleReInit,
  }
}
