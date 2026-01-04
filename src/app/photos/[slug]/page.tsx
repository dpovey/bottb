import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getPhotoBySlugOrId, isUuid, ensurePhotoSlug } from '@/lib/photo-slugs'
import { getBaseUrl } from '@/lib/seo'
import { buildSlideshowUrl } from '@/lib/shuffle-types'
import { ImageObjectJsonLd } from '@/components/seo'
import { PublicLayout } from '@/components/layouts'
import { PhotoPageClient } from './photo-page-client'

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

  // Build a descriptive title with photo number
  const parts: string[] = []
  if (photo.band_name) parts.push(photo.band_name)
  if (photo.event_name) parts.push(photo.event_name)
  const baseTitle = parts.length > 0 ? parts.join(' at ') : 'Photo'
  const title = photoNumber
    ? `${baseTitle} #${photoNumber} | Battle of the Tech Bands`
    : `${baseTitle} | Battle of the Tech Bands`

  // Build description
  let description = 'A photo from Battle of the Tech Bands'
  if (photo.band_name && photo.event_name) {
    description = `${photo.band_name} performing at ${photo.event_name}`
  } else if (photo.band_name) {
    description = `${photo.band_name} at Battle of the Tech Bands`
  } else if (photo.event_name) {
    description = `Photo from ${photo.event_name}`
  }
  if (photo.photographer) {
    description += ` • Photo by ${photo.photographer}`
  }

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

  // Build breadcrumbs
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
  if (photo.band_name) {
    breadcrumbs.push({ label: photo.band_name })
  } else {
    breadcrumbs.push({ label: 'Photo' })
  }

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
      </main>
    </PublicLayout>
  )
}
