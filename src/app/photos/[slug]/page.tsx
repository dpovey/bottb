import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getPhotoBySlugOrId, isUuid, ensurePhotoSlug } from '@/lib/photo-slugs'
import { getAdjacentPhotos, getSimilarPhotos } from '@/lib/db'
import { getBaseUrl, buildSeoTitle, buildSeoDescription } from '@/lib/seo'
import { slugify } from '@/lib/utils'
import { buildSlideshowUrl } from '@/lib/shuffle-types'
import { ImageObjectJsonLd } from '@/components/seo'
import { PublicLayout } from '@/components/layouts'
import { PhotoPageClient } from './photo-page-client'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'
import type { Photo } from '@/lib/db-types'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{
    event?: string
    photographer?: string
    company?: string
    shuffle?: string
  }>
}

/**
 * Extract the photo number from a slug (e.g., "band-event-85" -> "85")
 */
function getPhotoNumberFromSlug(slug: string | null): string | null {
  if (!slug) return null
  const match = slug.match(/-(\d+)$/)
  return match ? match[1] : null
}

/**
 * Server-rendered navigation links to adjacent photos
 * These are crawlable by search engines
 */
function PhotoNavigation({
  previous,
  next,
}: {
  previous: Photo | null
  next: Photo | null
}) {
  if (!previous && !next) return null

  return (
    <nav
      aria-label="Photo navigation"
      className="flex items-center justify-between mt-8 pt-6 border-t border-white/10"
    >
      {previous ? (
        <Link
          href={`/photos/${previous.slug}`}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-white transition-colors group"
        >
          <ChevronLeftIcon
            size={16}
            className="group-hover:-translate-x-0.5 transition-transform"
          />
          <span>Previous</span>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={`/photos/${next.slug}`}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-white transition-colors group"
        >
          <span>Next</span>
          <ChevronRightIcon
            size={16}
            className="group-hover:translate-x-0.5 transition-transform"
          />
        </Link>
      ) : (
        <div />
      )}
    </nav>
  )
}

/**
 * Server-rendered similar photos grid
 * Uses rel="nofollow" to avoid passing link equity to near-duplicates
 */
function SimilarPhotos({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) return null

  return (
    <section className="mt-10 pt-8 border-t border-white/10">
      <h2 className="text-lg font-medium mb-4 text-text-muted">
        Similar photos
      </h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {photos.map((photo) => (
          <Link
            key={photo.id}
            href={`/photos/${photo.slug}`}
            rel="nofollow"
            className="relative aspect-square rounded-md overflow-hidden bg-bg-elevated hover:ring-2 hover:ring-accent transition-all"
          >
            <Image
              src={photo.thumbnail_url || photo.blob_url}
              alt={`Similar photo${photo.band_name ? ` of ${photo.band_name}` : ''}`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 16vw"
            />
          </Link>
        ))}
      </div>
    </section>
  )
}

/**
 * Build metadata for the photo page
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const photo = await getPhotoBySlugOrId(slug)

  if (!photo) {
    return {
      title: 'Photo Not Found | Battle of the Tech Bands',
    }
  }

  // Extract photo number from slug for uniqueness
  const photoNumber = getPhotoNumberFromSlug(photo.slug)

  // Detect if this is a general event photo vs band-specific photo
  // Event photos have slugs like "sydney-2025-1" (starting with slugified event name)
  // Band photos have slugs like "the-agentics-sydney-2025-1" (starting with slugified band name)
  const eventSlug = photo.event_name ? slugify(photo.event_name) : ''
  const isEventPhoto = photo.slug?.startsWith(eventSlug + '-')

  // Build a descriptive title - differentiate event vs band photos
  let baseTitle: string
  if (isEventPhoto && photo.event_name) {
    // Event photo: "Sydney 2025 Photo #1" - distinct from band photos
    baseTitle = photoNumber
      ? `${photo.event_name} Photo #${photoNumber}`
      : `${photo.event_name} Photo`
  } else if (photo.band_name && photo.event_name) {
    // Band photo: "The Agentics at Sydney 2025 #1"
    baseTitle = photoNumber
      ? `${photo.band_name} at ${photo.event_name} #${photoNumber}`
      : `${photo.band_name} at ${photo.event_name}`
  } else if (photo.band_name) {
    baseTitle = photoNumber
      ? `${photo.band_name} #${photoNumber}`
      : photo.band_name
  } else if (photo.event_name) {
    baseTitle = photoNumber
      ? `${photo.event_name} #${photoNumber}`
      : photo.event_name
  } else {
    baseTitle = photoNumber ? `Photo #${photoNumber}` : 'Photo'
  }

  // Use tiered suffix approach for title
  const title = buildSeoTitle(baseTitle)

  // Build description - ensure it meets minimum length requirements
  let description: string
  if (photo.band_name && photo.event_name) {
    description = `${photo.band_name} performing at ${photo.event_name}, Australia's premier corporate battle of the bands competition`
  } else if (photo.band_name) {
    description = `${photo.band_name} performing at Battle of the Tech Bands, Australia's premier corporate battle of the bands`
  } else if (photo.event_name) {
    description = `Photo from ${photo.event_name} - Battle of the Tech Bands, Australia's premier corporate battle of the bands`
  } else {
    description =
      "A photo from Battle of the Tech Bands, Australia's premier corporate battle of the bands competition"
  }
  if (photo.photographer) {
    description += `. Photo by ${photo.photographer}`
  }

  // Ensure description fits within SEO limits
  description = buildSeoDescription(description)

  const baseUrl = getBaseUrl()
  // Use slug for canonical URL, fall back to id if no slug
  const canonicalSlug = photo.slug || photo.id

  return {
    title,
    description,
    alternates: {
      canonical: `${baseUrl}/photos/${canonicalSlug}`,
    },
    openGraph: {
      title,
      description,
      type: 'article',
      images: [
        {
          url: photo.medium_url || photo.blob_url,
          width: 1200,
          height: 630,
          alt: description,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [photo.medium_url || photo.blob_url],
    },
  }
}

/**
 * Photo detail page - SEO-optimized with server-rendered content
 */
export default async function PhotoPage({ params, searchParams }: Props) {
  const [{ slug }, filters] = await Promise.all([params, searchParams])

  // If this is a UUID, redirect to the slug URL
  if (isUuid(slug)) {
    const photoSlug = await ensurePhotoSlug(slug)
    if (photoSlug) {
      const queryString = new URLSearchParams(
        filters as Record<string, string>
      ).toString()
      redirect(`/photos/${photoSlug}${queryString ? `?${queryString}` : ''}`)
    }
  }

  const photo = await getPhotoBySlugOrId(slug)

  if (!photo) {
    notFound()
  }

  // Fetch adjacent and similar photos for SEO navigation
  const [adjacentPhotos, similarPhotos] = await Promise.all([
    getAdjacentPhotos(
      photo.id,
      photo.slug_prefix || null,
      photo.event_id || null
    ),
    getSimilarPhotos(photo.id, 6),
  ])

  // Extract photo number from slug for uniqueness
  const photoNumber = getPhotoNumberFromSlug(photo.slug)

  // Build H1 text for SEO (with photo number for uniqueness)
  let h1Text = 'Photo from Battle of the Tech Bands'
  if (photo.band_name && photo.event_name) {
    h1Text = `${photo.band_name} at ${photo.event_name}`
  } else if (photo.band_name) {
    h1Text = `${photo.band_name} at Battle of the Tech Bands`
  } else if (photo.event_name) {
    h1Text = `Photo from ${photo.event_name}`
  }
  if (photoNumber) {
    h1Text += ` #${photoNumber}`
  }

  // Build gallery URL with filters preserved
  const galleryParams = new URLSearchParams()
  if (filters.event) galleryParams.set('event', filters.event)
  if (filters.photographer)
    galleryParams.set('photographer', filters.photographer)
  if (filters.company) galleryParams.set('company', filters.company)
  if (filters.shuffle) galleryParams.set('shuffle', filters.shuffle)
  const galleryUrl = `/photos${galleryParams.toString() ? `?${galleryParams.toString()}` : ''}`

  // Build breadcrumbs: Home > Photos > Event > Company > #42
  const breadcrumbs: { label: string; href?: string }[] = [
    { label: 'Home', href: '/' },
    { label: 'Photos', href: galleryUrl },
  ]
  if (photo.event_name) {
    breadcrumbs.push({
      label: photo.event_name,
      href: `/photos?event=${photo.event_id}`,
    })
  }
  if (photo.band_name && photo.company_slug) {
    // Link to company photos
    breadcrumbs.push({
      label: photo.band_name,
      href: `/photos?company=${photo.company_slug}`,
    })
  }
  // Final item: photo number (no link - current page)
  breadcrumbs.push({ label: photoNumber ? `#${photoNumber}` : 'Photo' })

  // Build slideshow URL for interactive viewing
  const slideshowUrl = buildSlideshowUrl({
    photoId: photo.id,
    eventId: filters.event,
    photographer: filters.photographer,
    companySlug: filters.company,
    shuffle: filters.shuffle,
  })

  return (
    <PublicLayout breadcrumbs={breadcrumbs} footerVariant="simple">
      {/* JSON-LD structured data for search engines */}
      <ImageObjectJsonLd photo={photo} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Page title - visible for SEO and accessibility */}
        <h1 className="text-2xl md:text-3xl font-semibold mb-6">{h1Text}</h1>

        {/* Client-side interactive content */}
        <PhotoPageClient
          photo={photo}
          h1Text={h1Text}
          slideshowUrl={slideshowUrl}
          galleryUrl={galleryUrl}
        />

        {/* Server-rendered navigation for SEO crawlability */}
        <PhotoNavigation
          previous={adjacentPhotos.previous}
          next={adjacentPhotos.next}
        />

        {/* Similar photos with nofollow to avoid duplicate content issues */}
        <SimilarPhotos photos={similarPhotos} />
      </main>
    </PublicLayout>
  )
}
