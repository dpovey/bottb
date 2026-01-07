import { Photo } from '@/lib/db'
import { getBaseUrl } from '@/lib/seo'
import { slugify } from '@/lib/utils'

interface ImageObjectJsonLdProps {
  photo: Photo
}

export function ImageObjectJsonLd({ photo }: ImageObjectJsonLdProps) {
  const baseUrl = getBaseUrl()
  // Use slug URL if available, otherwise fall back to UUID
  const photoUrl = photo.slug
    ? `${baseUrl}/photos/${photo.slug}`
    : `${baseUrl}/slideshow/${photo.id}`
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    contentUrl: photo.blob_url,
    thumbnailUrl: photo.thumbnail_url || photo.blob_url,
    name: photo.original_filename || 'Photo',
    description:
      photo.band_name && photo.event_name
        ? `${photo.band_name} performing at ${photo.event_name}`
        : photo.band_name
          ? `${photo.band_name} at Battle of the Tech Bands`
          : photo.event_name
            ? `Photo from ${photo.event_name}`
            : 'A photo from Battle of the Tech Bands',
    url: photoUrl,
    ...(photo.photographer && {
      creator: {
        '@type': 'Person',
        name: photo.photographer,
        url: photo.photographer
          ? `${baseUrl}/photographer/${slugify(photo.photographer)}`
          : undefined,
      },
    }),
    ...(photo.band_name && {
      about: {
        '@type': 'MusicGroup',
        name: photo.band_name,
      },
    }),
    ...(photo.event_name && {
      contentLocation: {
        '@type': 'Event',
        name: photo.event_name,
      },
    }),
    // Licensing fields required by Google Search Console
    license: 'https://creativecommons.org/licenses/by-nc/4.0/',
    acquireLicensePage: `${baseUrl}/licensing`,
    copyrightNotice: `© ${new Date().getFullYear()} Battle of the Tech Bands. Licensed under CC BY-NC 4.0.`,
    creditText: photo.photographer
      ? `Photo by ${photo.photographer} for Battle of the Tech Bands`
      : 'Battle of the Tech Bands',
    copyrightHolder: {
      '@type': 'Organization',
      name: 'Battle of the Tech Bands',
    },
  }

  return (
    <script
      id={`image-object-jsonld-${photo.id}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, '\\u003c'),
      }}
    />
  )
}
