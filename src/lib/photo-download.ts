/**
 * Resolves which file a public photo download should fetch and what to name it.
 *
 * Downloads serve the full-resolution original when one was kept. Older photos
 * have no original, so they fall back to blob_url (the 2000px WebP) and take
 * the WebP extension, never the source's `.jpg`.
 */

import type { Photo } from './db-types'
import { slugify } from './utils'

export type PhotoDownloadSource = Pick<
  Photo,
  'id' | 'blob_url' | 'original_blob_url' | 'original_filename' | 'band_id'
> & {
  event_name?: string | null
}

export interface PhotoDownload {
  url: string
  filename: string
}

/** Lower-case file extension of a URL's path, ignoring query and hash. */
export function getUrlExtension(url: string): string | null {
  let pathname: string
  try {
    pathname = new URL(url, 'https://placeholder.invalid').pathname
  } catch {
    return null
  }
  const lastSegment = pathname.split('/').pop() ?? ''
  const match = lastSegment.match(/\.([a-z0-9]+)$/i)
  return match ? match[1].toLowerCase() : null
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^./\\]+$/, '')
}

function fallbackBaseName(photo: PhotoDownloadSource): string {
  const context =
    photo.band_id || (photo.event_name && slugify(photo.event_name)) || 'photo'
  return `bottb-${context}-${photo.id.slice(0, 8)}`
}

export function getPhotoDownload(photo: PhotoDownloadSource): PhotoDownload {
  if (photo.original_blob_url) {
    const ext = getUrlExtension(photo.original_blob_url) ?? 'jpg'
    return {
      url: photo.original_blob_url,
      filename: photo.original_filename || `${fallbackBaseName(photo)}.${ext}`,
    }
  }

  const ext = getUrlExtension(photo.blob_url) ?? 'webp'
  const baseName =
    (photo.original_filename && stripExtension(photo.original_filename)) ||
    fallbackBaseName(photo)
  return { url: photo.blob_url, filename: `${baseName}.${ext}` }
}
