'use client'

import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const PIXEL_ID = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID

function FacebookPixelInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!PIXEL_ID) return
    if (process.env.NODE_ENV !== 'production') return

    const firePageView = () => {
      if (typeof window.fbq === 'function') {
        window.fbq('track', 'PageView')
      }
    }

    if (initializedRef.current) {
      firePageView()
      return
    }

    const init = async () => {
      const ReactPixel = (await import('react-facebook-pixel')).default
      ReactPixel.init(PIXEL_ID)
      ReactPixel.pageView()
      initializedRef.current = true
    }

    if (typeof requestIdleCallback !== 'undefined') {
      const handle = requestIdleCallback(() => void init(), { timeout: 2000 })
      return () => cancelIdleCallback(handle)
    }

    const timeout = setTimeout(() => void init(), 100)
    return () => clearTimeout(timeout)
  }, [pathname, searchParams])

  return null
}

/**
 * Meta Pixel loader. Initialises once on first idle tick, then fires PageView
 * on every App Router route change so SPA navigation feeds Meta audiences.
 */
export function FacebookPixel() {
  return (
    <Suspense fallback={null}>
      <FacebookPixelInner />
    </Suspense>
  )
}
