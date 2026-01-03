import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getPhotoBySlugOrId, isUuid, ensurePhotoSlug } from '@/lib/photo-slugs'
import { getBaseUrl } from '@/lib/seo'
import { ImageObjectJsonLd } from '@/components/seo'
import { PublicLayout } from '@/components/layouts'
import {
  ChevronLeftIcon,
  CameraIcon,
  CalendarIcon,
  MusicNoteIcon,
  PlayCircleIcon,
} from '@/components/icons'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{
    event?: string
    photographer?: string
    company?: string
  }>
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

  // Build a descriptive title
  const parts: string[] = []
  if (photo.band_name) parts.push(photo.band_name)
  if (photo.event_name) parts.push(photo.event_name)
  const title =
    parts.length > 0
      ? `${parts.join(' at ')} | Battle of the Tech Bands`
      : 'Battle of the Tech Bands'

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

  // Build H1 text for SEO
  let h1Text = 'Photo from Battle of the Tech Bands'
  if (photo.band_name && photo.event_name) {
    h1Text = `${photo.band_name} at ${photo.event_name}`
  } else if (photo.band_name) {
    h1Text = `${photo.band_name} at Battle of the Tech Bands`
  } else if (photo.event_name) {
    h1Text = `Photo from ${photo.event_name}`
  }

  // Build breadcrumbs
  const breadcrumbs: { label: string; href?: string }[] = [
    { label: 'Home', href: '/' },
    { label: 'Photos', href: '/photos' },
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
  const slideshowParams = new URLSearchParams()
  if (filters.event) slideshowParams.set('event', filters.event)
  if (filters.photographer)
    slideshowParams.set('photographer', filters.photographer)
  if (filters.company) slideshowParams.set('company', filters.company)
  const slideshowUrl = `/slideshow/${photo.id}${slideshowParams.toString() ? `?${slideshowParams.toString()}` : ''}`

  return (
    <PublicLayout breadcrumbs={breadcrumbs} footerVariant="simple">
      {/* JSON-LD structured data for search engines */}
      <ImageObjectJsonLd photo={photo} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Page title - visible for SEO and accessibility */}
        <h1 className="text-2xl md:text-3xl font-semibold mb-6">{h1Text}</h1>

        {/* Photo container */}
        <div className="relative bg-bg-elevated rounded-lg overflow-hidden">
          {/* Server-rendered image for SEO - clickable to open slideshow */}
          <Link
            href={slideshowUrl}
            className="block relative aspect-[4/3] cursor-pointer"
          >
            <Image
              src={photo.large_4k_url || photo.medium_url || photo.blob_url}
              alt={h1Text}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1152px"
              priority
            />
          </Link>
        </div>

        {/* Slideshow button */}
        <div className="mt-4 flex justify-center">
          <Link
            href={slideshowUrl}
            className="border border-accent/40 text-accent hover:bg-accent/10 px-6 py-3 rounded-full text-xs tracking-widest uppercase font-medium flex items-center gap-2 transition-colors"
          >
            <PlayCircleIcon size={16} />
            Slideshow
          </Link>
        </div>

        {/* Photo metadata */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Event */}
          {photo.event_name && (
            <Link
              href={`/event/${photo.event_id}`}
              className="flex items-center gap-3 p-4 bg-bg-elevated rounded-lg hover:bg-bg-surface transition-colors"
            >
              <CalendarIcon size={20} className="text-accent flex-shrink-0" />
              <div>
                <div className="text-sm text-text-muted">Event</div>
                <div className="font-medium">{photo.event_name}</div>
              </div>
            </Link>
          )}

          {/* Band */}
          {photo.band_name && (
            <Link
              href={`/band/${photo.band_id}`}
              className="flex items-center gap-3 p-4 bg-bg-elevated rounded-lg hover:bg-bg-surface transition-colors"
            >
              <MusicNoteIcon size={20} className="text-accent flex-shrink-0" />
              <div>
                <div className="text-sm text-text-muted">Band</div>
                <div className="font-medium">{photo.band_name}</div>
              </div>
            </Link>
          )}

          {/* Photographer */}
          {photo.photographer && (
            <Link
              href={`/photographer/${encodeURIComponent(photo.photographer.toLowerCase().replace(/\s+/g, '-'))}`}
              className="flex items-center gap-3 p-4 bg-bg-elevated rounded-lg hover:bg-bg-surface transition-colors"
            >
              <CameraIcon size={20} className="text-accent flex-shrink-0" />
              <div>
                <div className="text-sm text-text-muted">Photographer</div>
                <div className="font-medium">{photo.photographer}</div>
              </div>
            </Link>
          )}

          {/* Company */}
          {photo.company_name && (
            <Link
              href={`/companies/${photo.company_slug}`}
              className="flex items-center gap-3 p-4 bg-bg-elevated rounded-lg hover:bg-bg-surface transition-colors"
            >
              <div className="w-5 h-5 rounded bg-bg-surface flex items-center justify-center flex-shrink-0">
                {photo.company_icon_url ? (
                  <Image
                    src={photo.company_icon_url}
                    alt={photo.company_name}
                    width={16}
                    height={16}
                    className="rounded-sm"
                  />
                ) : (
                  <span className="text-xs font-medium text-text-muted">
                    {photo.company_name.charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <div className="text-sm text-text-muted">Company</div>
                <div className="font-medium">{photo.company_name}</div>
              </div>
            </Link>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-8 text-sm text-text-muted">
          <Link
            href="/photos"
            className="flex items-center gap-1 hover:text-text transition-colors"
          >
            <ChevronLeftIcon size={16} />
            Back to Gallery
          </Link>
        </div>
      </main>
    </PublicLayout>
  )
}
