import type { NextConfig } from 'next'
import path from 'path'
import { withPostHogConfig } from '@posthog/nextjs-config'

// Security headers configuration
const securityHeaders = [
  {
    // Strict Transport Security - enforce HTTPS
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    // Prevent clickjacking - only allow same origin framing
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    // Prevent MIME type sniffing
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // Control referrer information
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    // Permissions Policy - restrict browser features
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=()',
  },
  {
    // Content Security Policy
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Scripts: self, inline (Next.js needs this), eval for dev, and trusted domains
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us.i.posthog.com https://us-assets.i.posthog.com https://connect.facebook.net https://www.youtube.com https://s.ytimg.com https://va.vercel-scripts.com",
      // Styles: self, inline (Tailwind/Next.js), Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Images: self, data URIs, blob storage, external sources
      "img-src 'self' data: blob: https://0qipqwe5exqqyona.public.blob.vercel-storage.com https://images.unsplash.com https://img.youtube.com https://i.ytimg.com https://www.facebook.com",
      // Fonts: self, Google Fonts
      "font-src 'self' https://fonts.gstatic.com",
      // Connect: API calls, analytics, PostHog (including assets for session recording)
      "connect-src 'self' https://us.i.posthog.com https://us-assets.i.posthog.com https://vitals.vercel-insights.com https://www.facebook.com https://*.vercel-storage.com",
      // Frames: YouTube embeds
      "frame-src 'self' https://www.youtube.com https://www.facebook.com",
      // Media: self, blob storage
      "media-src 'self' blob: https://0qipqwe5exqqyona.public.blob.vercel-storage.com",
      // Workers: PostHog session recording uses web workers
      "worker-src 'self' blob:",
      // Object: none (no plugins)
      "object-src 'none'",
      // Base URI: self only
      "base-uri 'self'",
      // Form actions: self only
      "form-action 'self'",
      // Frame ancestors: same as X-Frame-Options
      "frame-ancestors 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: path.join(__dirname, '.'),
  reactCompiler: true,
  experimental: {
    useCache: true, // Enables "use cache" directive
  },
  // Custom cache life profiles for "use cache" directive
  cacheLife: {
    // 5-minute cache - good for navigation data, filter options
    fiveMinutes: {
      stale: 300, // Serve stale for 5 minutes
      revalidate: 300, // Revalidate after 5 minutes
      expire: 3600, // Expire after 1 hour
    },
  },
  images: {
    // Enable AVIF format for 30-50% smaller images than WebP
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '0qipqwe5exqqyona.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Apply security headers to all routes
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Cache static assets for longer periods
        source:
          '/:path*\\.(jpg|jpeg|png|gif|webp|avif|svg|ico|woff|woff2|ttf|eot)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache JavaScript and CSS with shorter cache but allow revalidation
        source: '/:path*\\.(js|css)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

export default withPostHogConfig(nextConfig, {
  personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY!,
  envId: process.env.POSTHOG_ENV_ID!,
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
})
