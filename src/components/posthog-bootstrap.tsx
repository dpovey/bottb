'use client'

import { useEffect } from 'react'
import { usePostHog } from '@posthog/next'

/**
 * Registers environment metadata as super properties on PostHog so every
 * subsequent event carries it. One PostHog project serves all environments;
 * dashboards filter on these properties to separate prod from dev/preview.
 */
export function PostHogBootstrap() {
  const posthog = usePostHog()

  useEffect(() => {
    if (!posthog) return

    const nodeEnv = process.env.NODE_ENV
    const hostname = window.location.hostname
    const isDev =
      nodeEnv === 'development' ||
      hostname.includes('localhost') ||
      hostname.includes('127.0.0.1') ||
      (hostname.includes('.vercel.app') && !hostname.includes('bottb'))

    posthog.register({
      environment: nodeEnv || 'unknown',
      is_development: isDev ? 'true' : 'false',
      is_production: nodeEnv === 'production' && !isDev ? 'true' : 'false',
    })

    if (nodeEnv === 'development') {
      posthog.debug()
    }
  }, [posthog])

  return null
}
