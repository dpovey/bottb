'use client'

import { useEffect, useRef, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'

/**
 * Captures $pageview on route changes. The initial pageview is fired from
 * instrumentation-client.ts's `loaded` callback after super properties are
 * registered, so this tracker skips its first run to avoid a duplicate.
 *
 * Environment metadata (environment / is_development / is_production) is
 * attached via super properties registered at init, so events here don't
 * need to set them explicitly.
 *
 * useSearchParams() needs a Suspense boundary to stay compatible with
 * static generation.
 */
function PostHogPageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // The 'photo' search param is excluded so slideshow navigation doesn't
  // fire $pageview — that's tracked separately via trackPhotoView.
  const searchParamsWithoutPhoto = new URLSearchParams(searchParams.toString())
  searchParamsWithoutPhoto.delete('photo')
  const stableSearchParams = searchParamsWithoutPhoto.toString()

  const isInitialRender = useRef(true)

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false
      return
    }
    if (typeof window === 'undefined') return
    if (process.env.NODE_ENV === 'test') return
    const isInitialized =
      posthog && (posthog as { __loaded?: boolean }).__loaded === true
    if (!isInitialized) return

    const url = new URL(window.location.href)
    url.searchParams.delete('photo')
    posthog.capture('$pageview', { $current_url: url.toString() })
  }, [pathname, stableSearchParams])

  return null
}

/**
 * PostHog Provider - Wraps app with PostHog React context and tracks page views
 *
 * PostHog initialization is handled by instrumentation-client.ts (Next.js 15.3+ best practice).
 * This provider:
 * - Wraps the app with PostHog's React context
 * - Tracks page views when routes change (after navigation completes)
 *
 * Note: useSearchParams() is wrapped in Suspense to support static generation
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      {children}
      <Suspense fallback={null}>
        <PostHogPageViewTracker />
      </Suspense>
    </PHProvider>
  )
}
