'use client'

import { Photo } from '@/lib/db-types'
import { CompanyIcon } from '@/components/ui'

interface PhotoCardProps {
  photo: Photo
  onClick: () => void
  showCompanyLogo?: boolean
}

// Build srcSet for responsive thumbnails (1x: 300px, 2x: 600px, 3x: 900px)
function buildThumbnailSrcSet(photo: Photo): string | undefined {
  const sources: string[] = []

  if (photo.thumbnail_url) {
    sources.push(`${photo.thumbnail_url} 300w`)
  }
  if (photo.thumbnail_2x_url) {
    sources.push(`${photo.thumbnail_2x_url} 600w`)
  }
  if (photo.thumbnail_3x_url) {
    sources.push(`${photo.thumbnail_3x_url} 900w`)
  }

  return sources.length > 1 ? sources.join(', ') : undefined
}

export function PhotoCard({
  photo,
  onClick,
  showCompanyLogo = true,
}: PhotoCardProps) {
  // Use best available thumbnail: prefer 3x (900px), fallback to 2x, then 1x, then blob
  const thumbSrc =
    photo.thumbnail_3x_url ||
    photo.thumbnail_2x_url ||
    photo.thumbnail_url ||
    photo.blob_url
  const srcSet = buildThumbnailSrcSet(photo)
  // Use smart focal point for intelligent cropping (defaults to center)
  const focalPoint = photo.hero_focal_point ?? { x: 50, y: 50 }

  return (
    <div
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-bg-elevated transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)]"
      onClick={onClick}
    >
      {/* Thumbnail with responsive srcSet for crisp display on all devices */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={thumbSrc}
        src={thumbSrc}
        srcSet={srcSet}
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        alt={photo.original_filename || 'Photo'}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        style={{ objectPosition: `${focalPoint.x}% ${focalPoint.y}%` }}
        loading="lazy"
      />

      {/* Company icon badge - always visible in top right if available */}
      {showCompanyLogo && photo.company_icon_url && (
        <div className="absolute top-2 right-2 p-1.5 bg-black/60 backdrop-blur-xs rounded-lg opacity-80 group-hover:opacity-100 transition-opacity">
          <CompanyIcon
            iconUrl={photo.company_icon_url}
            companyName={photo.company_name || 'Company'}
            size="sm"
            showFallback={false}
          />
        </div>
      )}

      {/* Hover overlay with info */}
      <div className="absolute inset-0 bg-linear-to-t from-bg via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute bottom-0 left-0 right-0 p-3">
          {photo.band_name && (
            <div className="flex items-center gap-2">
              {/* Show company icon next to band name if no top-right icon */}
              {!photo.company_icon_url && photo.company_name && (
                <CompanyIcon
                  iconUrl={photo.company_icon_url}
                  companyName={photo.company_name}
                  size="xs"
                  showFallback={false}
                />
              )}
              <p className="text-sm font-medium text-white truncate">
                {photo.band_name}
              </p>
            </div>
          )}
          {photo.event_name && (
            <p className="text-xs text-text-muted truncate">
              {photo.event_name}
            </p>
          )}
        </div>
      </div>

      {/* Accent border on hover */}
      <div className="absolute inset-0 rounded-lg border-2 border-accent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  )
}
