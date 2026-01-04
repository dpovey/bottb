import type { Metadata, Viewport } from 'next'
import { Jost } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import { Providers } from '@/components/providers'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { FacebookPixel } from '@/components/facebook-pixel'
import { AdminToggle } from '@/components/admin-toggle'
import { AdminToolbar } from '@/components/admin-toolbar'
import { ScrollRestoration } from '@/components/scroll-restoration'
import { PostHogProvider } from '@/components/posthog-provider'
import { NavigationProgress } from '@/components/navigation-progress'
import { getBaseUrl } from '@/lib/seo'
import { OrganizationJsonLd } from '@/components/seo'

const jost = Jost({
  subsets: ['latin'],
  variable: '--font-jost',
  weight: ['400', '500', '600', '700'],
  display: 'swap', // Optimize font loading with font-display: swap
})

export const metadata: Metadata = {
  title: 'Battle of the Tech Bands',
  description:
    "Where technology meets rock 'n' roll. A community charity event supporting Youngcare.",
  alternates: {
    canonical: getBaseUrl(),
  },
  manifest: '/site.webmanifest',
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BOTTB',
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [{ rel: 'mask-icon', url: '/favicon-32x32.png', color: '#F5A623' }],
  },
  openGraph: {
    title: 'Battle of the Tech Bands',
    description:
      "Where technology meets rock 'n' roll. A community charity event supporting Youngcare.",
    siteName: 'Battle of the Tech Bands',
    type: 'website',
    images: [
      {
        url: '/images/logos/bottb-horizontal.png',
        width: 1200,
        height: 630,
        alt: 'Battle of the Tech Bands',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Battle of the Tech Bands',
    description:
      "Where technology meets rock 'n' roll. A community charity event supporting Youngcare.",
    images: ['/images/logos/bottb-horizontal.png'],
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${jost.variable}`}>
      <head>
        <OrganizationJsonLd />
        {/* Resource hints for third-party domains - improve connection time */}
        {/* PostHog - critical for LCP (saves 660ms) */}
        <link rel="preconnect" href="https://us.i.posthog.com" />
        <link rel="preconnect" href="https://us-assets.i.posthog.com" />
        <link rel="dns-prefetch" href="https://us.i.posthog.com" />
        <link rel="dns-prefetch" href="https://us-assets.i.posthog.com" />
        {/* Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Facebook Pixel */}
        <link rel="preconnect" href="https://connect.facebook.net" />
        <link rel="dns-prefetch" href="https://connect.facebook.net" />
        {/* Vercel Analytics */}
        <link rel="preconnect" href="https://va.vercel-scripts.com" />
        <link rel="dns-prefetch" href="https://va.vercel-scripts.com" />
        {/* Vercel Speed Insights */}
        <link rel="preconnect" href="https://vitals.vercel-insights.com" />
        <link rel="dns-prefetch" href="https://vitals.vercel-insights.com" />
        {/* Image CDN */}
        <link
          rel="preconnect"
          href="https://0qipqwe5exqqyona.public.blob.vercel-storage.com"
        />
        <link
          rel="dns-prefetch"
          href="https://0qipqwe5exqqyona.public.blob.vercel-storage.com"
        />
      </head>
      <body
        className="font-sans antialiased bg-bg text-text"
        suppressHydrationWarning={true}
      >
        <ScrollRestoration />
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <PostHogProvider>
          <Providers>
            {children}
            <AdminToolbar />
          </Providers>
        </PostHogProvider>
        <Analytics />
        <SpeedInsights />
        <FacebookPixel />
        <AdminToggle />
      </body>
    </html>
  )
}
