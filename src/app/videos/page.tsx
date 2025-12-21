import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/seo'
import { VideosContent } from './videos-content'
import { getCachedVideosData, getNavEvents } from '@/lib/nav-data'

export const metadata: Metadata = {
  title: 'Videos | Battle of the Tech Bands',
  description:
    "Watch performance videos from Battle of the Tech Bands events. Relive the best moments from our tech community's bands.",
  alternates: {
    canonical: `${getBaseUrl()}/videos`,
  },
  openGraph: {
    title: 'Videos | Battle of the Tech Bands',
    description:
      "Watch performance videos from Battle of the Tech Bands events. Relive the best moments from our tech community's bands.",
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Videos | Battle of the Tech Bands',
    description:
      "Watch performance videos from Battle of the Tech Bands events. Relive the best moments from our tech community's bands.",
  },
}

interface VideosPageProps {
  searchParams: Promise<{
    event?: string
    band?: string
  }>
}

export default async function VideosPage({ searchParams }: VideosPageProps) {
  const params = await searchParams
  const initialEventId = params.event || null
  const initialBandId = params.band || null

  // Fetch all data in parallel
  const [videosData, navEvents] = await Promise.all([
    getCachedVideosData(
      initialEventId || undefined,
      initialBandId || undefined
    ),
    getNavEvents(),
  ])

  return (
    <VideosContent
      initialEventId={initialEventId}
      initialBandId={initialBandId}
      initialVideos={videosData.videos}
      initialFilterOptions={videosData.filterOptions}
      navEvents={navEvents}
    />
  )
}
