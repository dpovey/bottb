'use client'

import { useEffect } from 'react'

const FacebookPixel = () => {
  useEffect(() => {
    // Only initialize in production and if pixel ID is provided
    const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID

    if (pixelId && process.env.NODE_ENV === 'production') {
      // Dynamically import to avoid SSR issues
      import('react-facebook-pixel').then((ReactPixel) => {
        ReactPixel.default.init(pixelId)
        ReactPixel.default.pageView()
      })
    }
  }, [])

  return null
}

export { FacebookPixel }
