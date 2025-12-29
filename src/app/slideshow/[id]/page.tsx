import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPhotoById } from '@/lib/db'
import { getBaseUrl } from '@/lib/seo'
import { SlideshowPageContent } from './slideshow-page-content'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    event?: string
    photographer?: string
    company?: string
    shuffle?: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const photo = await getPhotoById(id)

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

  return {
    title,
    description,
    alternates: {
      canonical: `${baseUrl}/slideshow/${id}`,
    },
    openGraph: {
      title,
      description,
      type: 'article',
      images: [
        {
          url: photo.blob_url,
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
      images: [photo.blob_url],
    },
  }
}

export default async function SlideshowPage({ params, searchParams }: Props) {
  const [{ id }, filters] = await Promise.all([params, searchParams])

  const photo = await getPhotoById(id)

  if (!photo) {
    notFound()
  }

  // Shuffle param: 'true' for shared shuffle, specific seed string, or null for date order
  const shuffle = filters.shuffle || null

  return (
    <SlideshowPageContent
      initialPhotoId={id}
      initialEventId={filters.event || null}
      initialPhotographer={filters.photographer || null}
      initialCompanySlug={filters.company || null}
      initialShuffle={shuffle}
    />
  )
}
