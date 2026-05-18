'use client'

import { useEffect } from 'react'

const PARTNER_ID = process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID
const INSIGHT_SRC = 'https://snap.licdn.com/li.lms-analytics/insight.min.js'

/**
 * LinkedIn Insight Tag loader.
 *
 * Installs the lintrk queue stub immediately so calls fired before
 * insight.min.js loads are not lost, then deferred-loads the library on the
 * first idle tick to keep it off the critical path. Once loaded the library
 * auto-tracks page views and SPA navigation for Matched Audiences.
 */
export function LinkedInInsight() {
  useEffect(() => {
    if (!PARTNER_ID) return
    if (process.env.NODE_ENV !== 'production') return
    if (document.querySelector(`script[src="${INSIGHT_SRC}"]`)) return

    window._linkedin_partner_id = PARTNER_ID
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || []
    window._linkedin_data_partner_ids.push(PARTNER_ID)
    if (typeof window.lintrk !== 'function') {
      const queue: Array<[string, { conversion_id?: number } | undefined]> = []
      const stub = ((action: string, options?: { conversion_id?: number }) => {
        queue.push([action, options])
      }) as NonNullable<Window['lintrk']>
      stub.q = queue
      window.lintrk = stub
    }

    const inject = () => {
      const script = document.createElement('script')
      script.async = true
      script.src = INSIGHT_SRC
      document.head.appendChild(script)
    }

    if (typeof requestIdleCallback !== 'undefined') {
      const handle = requestIdleCallback(inject, { timeout: 2000 })
      return () => cancelIdleCallback(handle)
    }
    const timeout = setTimeout(inject, 100)
    return () => clearTimeout(timeout)
  }, [])

  return null
}
