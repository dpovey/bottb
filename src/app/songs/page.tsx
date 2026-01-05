import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SongsPageClient } from './songs-page-client'
import { getEvents, getCompanies, getAllSongs, getSongCount } from '@/lib/db'
import { getBaseUrl, DEFAULT_OG_IMAGE } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'All Songs | Battle of the Tech Bands',
  description:
    'Every song performed across all Battle of the Tech Bands events. Filter by event, band, company, or song type.',
  alternates: {
    canonical: `${getBaseUrl()}/songs`,
  },
  openGraph: {
    title: 'All Songs | Battle of the Tech Bands',
    description:
      'Every song performed across all Battle of the Tech Bands events. Filter by event, band, company, or song type.',
    type: 'website',
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: 'summary',
    title: 'All Songs | Battle of the Tech Bands',
    description:
      'Every song performed across all Battle of the Tech Bands events. Filter by event, band, company, or song type.',
  },
}

export default async function SongsPage() {
  // Fetch filter options and initial songs data server-side for SSR
  const [events, companies, initialSongs, totalSongs] = await Promise.all([
    getEvents(),
    getCompanies(),
    getAllSongs({ limit: 50, offset: 0 }),
    getSongCount({}),
  ])

  // Only show finalized events in the filter
  const finalizedEvents = events.filter((e) => e.status === 'finalized')

  // Suspense is required for useSearchParams() in the client component
  // But we pass initialSongs so the content is SSR'd with real data
  return (
    <Suspense>
      <SongsPageClient
        events={finalizedEvents.map((e) => ({ id: e.id, name: e.name }))}
        companies={companies.map((c) => ({ slug: c.slug, name: c.name }))}
        initialSongs={initialSongs}
        initialTotal={totalSongs}
      />
    </Suspense>
  )
}
