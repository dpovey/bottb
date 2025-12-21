'use client'

import { useEffect } from 'react'

const FacebookPixel = () => {
  useEffect(() => {
    // Only initialize in production and if pixel ID is provided
    const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID

    if (pixelId && process.env.NODE_ENV === 'production') {
      // Defer Facebook Pixel initialization to reduce blocking
      // Use requestIdleCallback if available, otherwise setTimeout
      const initPixel = () => {
        // Dynamically import to avoid SSR issues
        import('react-facebook-pixel').then((ReactPixel) => {
          ReactPixel.default.init(pixelId)
          ReactPixel.default.pageView()
        })
      }

      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(initPixel, { timeout: 2000 })
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(initPixel, 100)
      }
    }
  }, [])

  return null
}

export { FacebookPixel }
