import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { PhotosContent } from './photos-content'
import { PublicLayout } from '@/components/layouts'
import { Skeleton } from '@/components/ui'
import { getBaseUrl } from '@/lib/seo'
import { getCachedFilterOptions } from '@/lib/nav-data'
import { ensurePhotoSlug, isUuid } from '@/lib/photo-slugs'

// Loading fallback for Suspense - shows skeleton grid for better perceived performance
// Note: No H1 here - the actual content has the H1, avoiding duplicate H1s for SEO
function PhotosLoading() {
  return (
    <PublicLayout
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Photos' }]}
      footerVariant="simple"
    >
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col gap-4 mb-8">
          <div>
            <div className="font-semibold text-4xl mb-2">Photo Gallery</div>
            <p className="text-text-muted">Loading photos...</p>
          </div>
        </div>
        {/* Skeleton grid matching default grid size (md) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-8">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      </main>
    </PublicLayout>
  )
}

export const metadata: Metadata = {
  title: 'Photo Gallery | Battle of the Tech Bands',
  description:
    'Browse photos from Battle of the Tech Bands events. Filter by event, photographer, or company.',
  alternates: {
    canonical: `${getBaseUrl()}/photos`,
  },
  openGraph: {
    title: 'Photo Gallery | Battle of the Tech Bands',
    description:
      'Browse photos from Battle of the Tech Bands events. Filter by event, photographer, or company.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Photo Gallery | Battle of the Tech Bands',
    description:
      'Browse photos from Battle of the Tech Bands events. Filter by event, photographer, or company.',
  },
}

interface PhotosPageProps {
  searchParams: Promise<{
    event?: string
    eventId?: string
    photographer?: string
    company?: string
    // Legacy param - redirects to /photos/[slug]
    photo?: string
  }>
}

// Main page component - server component that resolves filters from URL params
export default async function PhotosPage({ searchParams }: PhotosPageProps) {
  const [params, filterOptions] = await Promise.all([
    searchParams,
    getCachedFilterOptions(),
  ])

  // Handle legacy ?photo= URLs - redirect to the new /photos/[slug] route
  if (params.photo) {
    const photoId = params.photo
    // If it's a UUID, try to get/generate a slug
    if (isUuid(photoId)) {
      const slug = await ensurePhotoSlug(photoId)
      if (slug) {
        redirect(`/photos/${slug}`)
      }
      // Fallback: redirect using UUID (the new route will handle it)
      redirect(`/photos/${photoId}`)
    }
    // It's already a slug
    redirect(`/photos/${photoId}`)
  }

  // Support both new (event) and legacy (eventId) param names
  const initialEventId = params.event || params.eventId || null
  const initialPhotographer = params.photographer || null
  const initialCompanySlug = params.company || null

  return (
    <Suspense fallback={<PhotosLoading />}>
      <PhotosContent
        initialEventId={initialEventId}
        initialPhotographer={initialPhotographer}
        initialCompanySlug={initialCompanySlug}
        initialFilterOptions={filterOptions}
        initialTotalPhotos={filterOptions.totalPhotos}
      />
    </Suspense>
  )
}
