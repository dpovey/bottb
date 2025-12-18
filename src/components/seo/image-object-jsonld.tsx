import { Photo } from "@/lib/db";
import { getBaseUrl } from "@/lib/seo";

interface ImageObjectJsonLdProps {
  photo: Photo;
}

export function ImageObjectJsonLd({ photo }: ImageObjectJsonLdProps) {
  const baseUrl = getBaseUrl();
  const schema = {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    contentUrl: photo.blob_url,
    thumbnailUrl: photo.thumbnail_url || photo.blob_url,
    name: photo.original_filename || "Photo",
    description: photo.band_name && photo.event_name
      ? `${photo.band_name} performing at ${photo.event_name}`
      : photo.band_name
      ? `${photo.band_name} at Battle of the Tech Bands`
      : photo.event_name
      ? `Photo from ${photo.event_name}`
      : "A photo from Battle of the Tech Bands",
    url: `${baseUrl}/photo/${photo.id}`,
    ...(photo.photographer && {
      creator: {
        "@type": "Person",
        name: photo.photographer,
        url: photo.photographer
          ? `${baseUrl}/photographer/${encodeURIComponent(
              photo.photographer.toLowerCase().replace(/\s+/g, "-")
            )}`
          : undefined,
      },
    }),
    ...(photo.band_name && {
      about: {
        "@type": "MusicGroup",
        name: photo.band_name,
      },
    }),
    ...(photo.event_name && {
      contentLocation: {
        "@type": "Event",
        name: photo.event_name,
      },
    }),
    license: "https://creativecommons.org/licenses/by/4.0/",
    copyrightHolder: {
      "@type": "Organization",
      name: "Battle of the Tech Bands",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

