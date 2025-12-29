'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { VinylSpinner } from '@/components/ui'

// External store for navigation state
// This allows us to update state outside of React's render cycle
const navigationStore = {
  targetUrl: null as string | null,
  listeners: new Set<() => void>(),
}

function getSnapshot() {
  return navigationStore.targetUrl
}

function subscribe(callback: () => void) {
  navigationStore.listeners.add(callback)
  return () => navigationStore.listeners.delete(callback)
}

function setTargetUrl(url: string | null) {
  navigationStore.targetUrl = url
  navigationStore.listeners.forEach((listener) => listener())
}

/**
 * NavigationProgress - Shows a dimmed overlay with spinner during page navigation
 *
 * Detects navigation by listening for clicks on internal links and hiding
 * the overlay when the URL changes. Handles both pathname and search param changes.
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Subscribe to external navigation store
  const targetUrl = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  // Build current URL string for comparison
  const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

  // Determine if we're actively navigating
  const isNavigating = targetUrl !== null && targetUrl !== currentUrl

  // When navigation completes (URL matches target), clear the target via external store
  useEffect(() => {
    if (targetUrl !== null && targetUrl === currentUrl) {
      setTargetUrl(null)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [targetUrl, currentUrl])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Listen for link clicks on the document
  useEffect(() => {
    function handleLinkClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      const link = target.closest('a')

      if (!link) return

      const href = link.getAttribute('href')
      if (!href) return

      // Only handle internal navigation (starting with /)
      // Skip external links, hash links, and special protocols
      if (!href.startsWith('/')) return
      if (href.startsWith('//')) return // protocol-relative URLs

      // Skip if user is using modifier keys (open in new tab, etc.)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      // Skip download links
      if (link.hasAttribute('download')) return

      // Skip target="_blank" links
      if (link.target === '_blank') return

      // Skip if navigating to the same URL
      if (href === currentUrl || href === pathname) return

      // Set target URL to start navigation indicator
      setTargetUrl(href)

      // Safety timeout - clear after 10s in case navigation fails
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        setTargetUrl(null)
      }, 10000)
    }

    document.addEventListener('click', handleLinkClick, true)
    return () => {
      document.removeEventListener('click', handleLinkClick, true)
    }
  }, [currentUrl, pathname])

  if (!isNavigating) return null

  return (
    <div
      className="fixed inset-0 z-[9999] bg-bg/60 backdrop-blur-sm flex items-center justify-center transition-opacity duration-200"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3">
        <VinylSpinner size="xs" className="text-accent" />
        <span className="text-sm text-text-muted tracking-wide">
          Loading...
        </span>
      </div>
    </div>
  )
}
