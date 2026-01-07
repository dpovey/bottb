import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PhotosContent } from './photos-content'
import { PublicLayout } from '@/components/layouts'
import { Skeleton } from '@/components/ui'
import { getBaseUrl, DEFAULT_OG_IMAGE } from '@/lib/seo'
import { getCachedFilterOptions } from '@/lib/nav-data'
import { ensurePhotoSlug, isUuid } from '@/lib/photo-slugs'
import { getPhotoCount } from '@/lib/db'

const PHOTOS_PER_PAGE = 50

/**
 * Server-rendered pagination links for SEO
 * These create crawlable paths through the photo gallery
 */
function PaginationLinks({
  totalPages,
  currentPage,
  baseUrl,
}: {
  totalPages: number
  currentPage: number
  baseUrl: string
}) {
  if (totalPages <= 1) return null

  // Show limited page numbers: first, last, and around current page
  const visiblePages: number[] = []
  const addPage = (page: number) => {
    if (page >= 1 && page <= totalPages && !visiblePages.includes(page)) {
      visiblePages.push(page)
    }
  }

  // Always show first and last
  addPage(1)
  addPage(totalPages)

  // Show pages around current
  for (let i = currentPage - 2; i <= currentPage + 2; i++) {
    addPage(i)
  }

  visiblePages.sort((a, b) => a - b)

  return (
    <nav
      aria-label="Photo gallery pages"
      className="mt-12 pt-8 border-t border-white/10"
    >
      <p className="text-sm text-text-muted mb-4">Browse all photos by page:</p>
      <div className="flex flex-wrap gap-2 text-sm">
        {visiblePages.map((page, index) => {
          // Check if there's a gap (ellipsis needed)
          const prevPage = visiblePages[index - 1]
          const showEllipsis = prevPage && page - prevPage > 1

          return (
            <span key={page} className="flex items-center gap-2">
              {showEllipsis && (
                <span className="text-text-muted px-1">...</span>
              )}
              <Link
                href={page === 1 ? baseUrl : `${baseUrl}?page=${page}`}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  page === currentPage
                    ? 'bg-accent text-white'
                    : 'bg-bg-elevated hover:bg-bg-surface text-text-muted hover:text-white'
                }`}
              >
                {page}
              </Link>
            </span>
          )
        })}
      </div>
    </nav>
  )
}

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
    images: [DEFAULT_OG_IMAGE],
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
    // Pagination param for SEO crawlability
    page?: string
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
  const currentPage = Math.max(1, parseInt(params.page || '1', 10))

  // Get total photo count for pagination
  const totalPhotos = await getPhotoCount({
    eventId: initialEventId || undefined,
    photographer: initialPhotographer || undefined,
    companySlug: initialCompanySlug || undefined,
  })
  const totalPages = Math.ceil(totalPhotos / PHOTOS_PER_PAGE)

  // Build base URL for pagination links (preserve filters)
  const paginationParams = new URLSearchParams()
  if (initialEventId) paginationParams.set('event', initialEventId)
  if (initialPhotographer)
    paginationParams.set('photographer', initialPhotographer)
  if (initialCompanySlug) paginationParams.set('company', initialCompanySlug)
  const baseUrl = paginationParams.toString()
    ? `/photos?${paginationParams.toString()}`
    : '/photos'

  return (
    <Suspense fallback={<PhotosLoading />}>
      <PhotosContent
        initialEventId={initialEventId}
        initialPhotographer={initialPhotographer}
        initialCompanySlug={initialCompanySlug}
        initialFilterOptions={filterOptions}
        initialTotalPhotos={filterOptions.totalPhotos}
      />
      {/* Server-rendered pagination links for SEO crawlability */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <PaginationLinks
          totalPages={totalPages}
          currentPage={currentPage}
          baseUrl={baseUrl}
        />
        {/* Licensing notice */}
        <p className="mt-8 text-xs text-text-dim">
          Photos licensed under{' '}
          <Link
            href="/licensing"
            className="text-text-muted hover:text-white transition-colors underline underline-offset-2"
          >
            CC BY-NC 4.0
          </Link>
        </p>
      </div>
    </Suspense>
  )
}
