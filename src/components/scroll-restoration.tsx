'use client'

import { useEffect, useRef } from 'react'

/**
 * Prevents unwanted programmatic scrolling on initial page load.
 * Blocks scrollIntoView and programmatic scrollTo calls, but allows user scrolling.
 */
export function ScrollRestoration() {
  const isInitialLoad = useRef(true)
  const userIsScrolling = useRef(false)
  const originalScrollTo = useRef<typeof window.scrollTo | null>(null)
  const originalScrollIntoView = useRef<
    typeof Element.prototype.scrollIntoView | null
  >(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const hasHash = window.location.hash !== ''

    // Disable browser scroll restoration
    if (window.history?.scrollRestoration) {
      window.history.scrollRestoration = 'manual'
    }

    // Set scroll to top immediately
    if (!hasHash) {
      window.scrollTo(0, 0)
    }

    // Store original functions
    originalScrollTo.current = window.scrollTo.bind(window)
    originalScrollIntoView.current = Element.prototype.scrollIntoView

    // BLOCK scrollIntoView completely during initial load (this is always programmatic)
    Element.prototype.scrollIntoView = function (
      ...args: Parameters<typeof Element.prototype.scrollIntoView>
    ) {
      if (isInitialLoad.current && !hasHash && !userIsScrolling.current) {
        // Block scrollIntoView during initial load (unless user is actively scrolling)
        return
      }
      return originalScrollIntoView.current!.apply(this, args)
    }

    // BLOCK programmatic scrollTo calls that aren't to position 0 during initial load
    window.scrollTo = function (
      xOrOptions?: number | ScrollToOptions,
      y?: number
    ): void {
      if (isInitialLoad.current && !hasHash && !userIsScrolling.current) {
        // Only allow scroll to top (0, 0) during initial load
        if (xOrOptions === undefined) {
          return originalScrollTo.current!(0, 0)
        }
        if (typeof xOrOptions === 'object') {
          const options = xOrOptions
          if (options.top === 0 || options.top === undefined) {
            return originalScrollTo.current!(options)
          }
          // Block any programmatic scroll that's not to top
          return
        }
        if (
          typeof xOrOptions === 'number' &&
          xOrOptions === 0 &&
          (y === undefined || y === 0)
        ) {
          return originalScrollTo.current!(xOrOptions, y ?? 0)
        }
        // Block any programmatic scroll that's not to top
        return
      }
      if (typeof xOrOptions === 'object') {
        return originalScrollTo.current!(xOrOptions)
      }
      return originalScrollTo.current!(xOrOptions ?? 0, y ?? 0)
    }

    // Detect user-initiated scrolling
    const markUserScrolling = () => {
      userIsScrolling.current = true
      // After user scrolls, stop blocking after a short delay
      setTimeout(() => {
        isInitialLoad.current = false
      }, 500)
    }

    // Listen for user input events that indicate scrolling
    const userInputEvents = [
      'wheel',
      'touchstart',
      'touchmove',
      'mousedown',
      'keydown',
    ]
    userInputEvents.forEach((event) => {
      window.addEventListener(
        event,
        () => {
          // Small delay to ensure this fires before scroll events
          setTimeout(markUserScrolling, 10)
        },
        { passive: true, once: false }
      )
    })

    // Monitor scroll position - only reset if it's programmatic (not user-initiated)
    let lastScrollY = 0

    const checkScroll = () => {
      if (!isInitialLoad.current || hasHash || userIsScrolling.current) {
        return
      }

      const currentScrollY = window.scrollY
      const scrollDelta = Math.abs(currentScrollY - lastScrollY)

      // If scroll position changed significantly (>50px) without user interaction,
      // it's likely a programmatic scroll - reset it
      if (scrollDelta > 50 && currentScrollY > 50) {
        // Reset scroll position immediately
        originalScrollTo.current!(0, 0)
        lastScrollY = 0
      } else {
        lastScrollY = currentScrollY
      }
    }

    // Check scroll position periodically (but less aggressively)
    let rafId: number
    const monitorScroll = () => {
      if (isInitialLoad.current) {
        checkScroll()
        rafId = requestAnimationFrame(monitorScroll)
      }
    }
    rafId = requestAnimationFrame(monitorScroll)

    // Stop blocking after 2 seconds (enough time for Suspense to resolve)
    const stopBlocking = setTimeout(() => {
      isInitialLoad.current = false

      // Restore original functions
      if (originalScrollTo.current) {
        window.scrollTo = originalScrollTo.current
      }
      if (originalScrollIntoView.current) {
        Element.prototype.scrollIntoView = originalScrollIntoView.current
      }

      cancelAnimationFrame(rafId)
    }, 2000)

    return () => {
      clearTimeout(stopBlocking)
      cancelAnimationFrame(rafId)
      userInputEvents.forEach((event) => {
        window.removeEventListener(event, markUserScrolling)
      })

      // Restore original functions
      if (originalScrollTo.current) {
        window.scrollTo = originalScrollTo.current
      }
      if (originalScrollIntoView.current) {
        Element.prototype.scrollIntoView = originalScrollIntoView.current
      }
    }
  }, [])

  return null
}
