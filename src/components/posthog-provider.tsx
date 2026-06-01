'use client'

import { useEffect, useRef, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'

/**
 * Captures $pageview on route changes. The initial pageview is fired from
 * instrumentation-client.ts's `loaded` callback after super properties are
 * registered, so this tracker skips its first observed URL to avoid a
 * duplicate.
 *
 * The URL is tracked via `lastTrackedUrl` ref (rather than a boolean
 * "first run" flag) so the effect is idempotent under React StrictMode's
 * dev-mode double-mount.
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

  const lastTrackedUrl = useRef<string>('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (process.env.NODE_ENV === 'test') return

    const url = new URL(window.location.href)
    url.searchParams.delete('photo')
    const urlString = url.toString()

    // First observed URL: record it without capturing — the initial pageview
    // is already fired by instrumentation-client.ts's `loaded` callback.
    if (!lastTrackedUrl.current) {
      lastTrackedUrl.current = urlString
      return
    }

    // Same URL as last tracked — StrictMode double-mount or a re-render
    // with no actual navigation. Skip to avoid duplicates.
    if (lastTrackedUrl.current === urlString) return

    const isInitialized =
      posthog && (posthog as { __loaded?: boolean }).__loaded === true
    if (!isInitialized) return

    lastTrackedUrl.current = urlString
    posthog.capture('$pageview', { $current_url: urlString })
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
