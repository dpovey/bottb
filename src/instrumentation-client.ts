'use client'

import posthog from 'posthog-js'

/**
 * PostHog initialization using Next.js 15.3+ instrumentation-client.ts
 *
 * This is the recommended approach for Next.js 15.3+ as it initializes
 * PostHog early in the application lifecycle before the app becomes interactive.
 *
 * Single Project Setup (using filtering):
 * - Use one PostHog project for all environments
 * - Events include environment metadata for filtering in PostHog dashboard
 * - Test environment: Automatically disabled (NODE_ENV=test)
 * - Development: Tracked with is_development="true" (filter in PostHog if needed)
 * - Production: Tracked with is_production="true"
 *
 * To disable dev tracking entirely, set NEXT_PUBLIC_DISABLE_DEV_TRACKING=true
 */
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || '/ph'
const nodeEnv = process.env.NODE_ENV

// Only initialize if:
// 1. API key is provided (allows per-environment control)
// 2. Not in test environment
// 3. Running in browser (client-side only)
// 4. Not already initialized
if (typeof window !== 'undefined') {
  if (!posthogKey) {
    if (nodeEnv === 'development') {
      console.warn(
        '[PostHog] NEXT_PUBLIC_POSTHOG_KEY not set - PostHog will not initialize'
      )
    }
  } else if (nodeEnv === 'test') {
    // Silently skip in test
  } else if (posthog && (posthog as { __loaded?: boolean }).__loaded === true) {
    // Already initialized (PostHog sets __loaded to true when ready)
    // Ensure debug mode is enabled in development
    if (nodeEnv === 'development') {
      posthog.debug()
    }
  } else {
    // Defer PostHog initialization to reduce blocking time
    // Use requestIdleCallback if available, otherwise setTimeout as fallback
    const initPostHog = () => {
      posthog.init(posthogKey, {
        api_host: posthogHost,
        person_profiles: 'identified_only', // Only create profiles for identified users
        capture_exceptions: {
          capture_unhandled_errors: true,
          capture_unhandled_rejections: true,
          capture_console_errors: false,
        },
        // Disable session recording on initial load to defer lazy-recorder.js
        // Session recording can be enabled later if needed
        disable_session_recording: true,
        loaded: (posthog) => {
          // Enable debug mode in development for easier debugging
          if (nodeEnv === 'development') {
            posthog.debug()
          }
        },
        // Enable debug mode immediately if in development
        // This ensures debug logs appear even before loaded callback
        ...(nodeEnv === 'development' ? { debug: true } : {}),
      })
    }

    // Defer initialization until after page is interactive
    // This reduces blocking time from PostHog scripts (275ms blocking task)
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(initPostHog, { timeout: 2000 })
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(initPostHog, 100)
    }
  }
}

// Note: Page view tracking is handled by PostHogProvider component
// which tracks route changes after navigation completes using usePathname/useSearchParams
