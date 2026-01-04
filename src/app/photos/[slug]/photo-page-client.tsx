'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Photo } from '@/lib/db-types'
import { PhotoAdminControls } from '@/components/photos/photo-admin-controls'
import { PhotoShareButton } from '@/components/photos/photo-share-button'
import {
  CalendarIcon,
  CameraIcon,
  MusicNoteIcon,
  PlayCircleIcon,
  ChevronLeftIcon,
  DownloadIcon,
} from '@/components/icons'
import { trackPhotoDownload } from '@/lib/analytics'

interface PhotoPageClientProps {
  /** The photo to display */
  photo: Photo
  /** H1 text for SEO and display */
  h1Text: string
  /** URL to the slideshow view */
  slideshowUrl: string
  /** URL back to the gallery */
  galleryUrl: string
}

/**
 * Client-side wrapper for the photo page.
 * Handles:
 * - Admin controls (edit metadata, hero labels, focal point, delete)
 * - Share button (copy link, native share)
 * - Download button
 * - Photo updates and navigation after edits
 */
export function PhotoPageClient({
  photo: initialPhoto,
  h1Text,
  slideshowUrl,
  galleryUrl,
}: PhotoPageClientProps) {
  const router = useRouter()
  const [photo, setPhoto] = useState<Photo>(initialPhoto)

  // Handle photo updates from admin controls
  const handlePhotoUpdated = useCallback(
    (updatedPhoto: Photo) => {
      setPhoto(updatedPhoto)
      // Refresh the page to get updated server-rendered content
      router.refresh()
    },
    [router]
  )

  // Handle photo deletion
  const handlePhotoDeleted = useCallback(() => {
    // Navigate back to gallery after deletion
    router.push(galleryUrl)
  }, [router, galleryUrl])

  // Handle photo download
  const handleDownload = async () => {
    try {
      const response = await fetch(photo.blob_url)
      const blob = await response.blob()

      // Generate filename
      const ext = photo.content_type?.split('/')[1] || 'jpg'
      const filename =
        photo.original_filename ||
        `bottb-${photo.band_name || 'photo'}-${photo.id.slice(0, 8)}.${ext}`

      // Create download link
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Track download
      trackPhotoDownload({
        photo_id: photo.id,
        event_id: photo.event_id || null,
        band_id: photo.band_id || null,
        event_name: photo.event_name || null,
        band_name: photo.band_name || null,
      })
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  return (
    <>
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

      {/* Action buttons row */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        {/* Slideshow button */}
        <Link
          href={slideshowUrl}
          className="border border-accent/40 text-accent hover:bg-accent/10 px-6 py-3 rounded-full text-xs tracking-widest uppercase font-medium flex items-center gap-2 transition-colors"
        >
          <PlayCircleIcon size={16} />
          Slideshow
        </Link>

        {/* Public share button */}
        <PhotoShareButton
          photo={photo}
          variant="share"
          size="md"
          className="border border-white/20 hover:border-white/40 rounded-full px-4"
        />

        {/* Download button */}
        <button
          onClick={handleDownload}
          className="p-2.5 border border-white/20 hover:border-white/40 rounded-full text-text-muted hover:text-white transition-colors"
          aria-label="Download high-resolution image"
          title="Download"
        >
          <DownloadIcon size={18} />
        </button>

        {/* Admin controls (only visible to admins) */}
        <PhotoAdminControls
          photo={photo}
          variant="inline"
          onPhotoUpdated={handlePhotoUpdated}
          onPhotoDeleted={handlePhotoDeleted}
        />
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
          href={galleryUrl}
          className="flex items-center gap-1 hover:text-text transition-colors"
        >
          <ChevronLeftIcon size={16} />
          Back to Gallery
        </Link>
      </div>
    </>
  )
}
