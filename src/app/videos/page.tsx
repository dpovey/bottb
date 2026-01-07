import type { Metadata } from 'next'
import { getBaseUrl, DEFAULT_OG_IMAGE } from '@/lib/seo'
import { VideosContent } from './videos-content'
import { getNavEvents, getCachedFilterOptions } from '@/lib/nav-data'
import { VideoObjectJsonLd } from '@/components/seo'
import { getVideos } from '@/lib/db'

export const metadata: Metadata = {
  title: 'Videos | Battle of the Tech Bands',
  description:
    "Watch performance videos and shorts from Battle of the Tech Bands events. Relive the best moments from our tech community's bands.",
  alternates: {
    canonical: `${getBaseUrl()}/videos`,
  },
  openGraph: {
    title: 'Videos | Battle of the Tech Bands',
    description:
      "Watch performance videos and shorts from Battle of the Tech Bands events. Relive the best moments from our tech community's bands.",
    type: 'website',
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Videos | Battle of the Tech Bands',
    description:
      "Watch performance videos and shorts from Battle of the Tech Bands events. Relive the best moments from our tech community's bands.",
  },
}

interface VideosPageProps {
  searchParams: Promise<{
    event?: string
    company?: string
    tab?: string
  }>
}

export default async function VideosPage({ searchParams }: VideosPageProps) {
  const params = await searchParams
  const initialEventId = params.event || null
  const initialCompanySlug = params.company || null
  const initialTab =
    params.tab === 'shorts' ? ('shorts' as const) : ('videos' as const)

  // Fetch all data in parallel
  const [videos, shorts, filterOptions, navEvents] = await Promise.all([
    getVideos({
      eventId: initialEventId || undefined,
      companySlug: initialCompanySlug || undefined,
      videoType: 'video',
      limit: 100,
    }),
    getVideos({
      eventId: initialEventId || undefined,
      companySlug: initialCompanySlug || undefined,
      videoType: 'short',
      limit: 100,
    }),
    getCachedFilterOptions(),
    getNavEvents(),
  ])

  // All videos for JSON-LD (both regular videos and shorts)
  const allVideos = [...videos, ...shorts]

  return (
    <>
      <VideoObjectJsonLd videos={allVideos} />
      <VideosContent
        initialEventId={initialEventId}
        initialCompanySlug={initialCompanySlug}
        initialTab={initialTab}
        initialVideos={videos}
        initialShorts={shorts}
        initialFilterOptions={filterOptions}
        navEvents={navEvents}
      />
    </>
  )
}
