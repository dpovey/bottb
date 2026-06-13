import { put } from '@vercel/blob'
import { randomUUID } from 'crypto'
import { processImage } from './image-processor'
import { sql } from './sql'
import type { PhotoVisibility } from './db-types'

export interface ProcessAndStorePhotoInput {
  /** Raw image bytes — any sharp-supported format. */
  buffer: Buffer
  /** Original filename (stored on the row for traceability). */
  filename: string
  /** Optional associations. */
  eventId?: string | null
  bandId?: string | null
  photographer?: string | null
  /** Photo labels (e.g. `['event_hero']`). */
  labels?: string[]
  /** Capture timestamp from EXIF/XMP, ISO string. Falls back to NOW(). */
  capturedAt?: string | null
  /**
   * Extra XMP/EXIF metadata to merge alongside the variant URLs. Callers
   * with raw images carrying capture device, GPS, copyright, etc. should
   * pass it here so it survives on the photo row.
   */
  extraXmpMetadata?: Record<string, unknown>
  /**
   * Visibility for the new photo. Defaults to 'private' so uploads start
   * admin-only and are released to the public later.
   */
  visibility?: PhotoVisibility
}

export interface ProcessAndStorePhotoResult {
  photoId: string
  /** The 2000-px `large.webp` URL — the canonical `blob_url` for hero use. */
  blobUrl: string
  width: number
  height: number
  variants: {
    thumbnail_url: string
    thumbnail_2x_url: string | null
    medium_url: string | null
    large_4k_url: string | null
  }
}

/**
 * Run a raw image through the processor and store every variant in blob
 * storage + a row in `photos`. This is the canonical upload path — any
 * image that should benefit from the WebP variant ladder and srcset should
 * go through here.
 *
 * Returns the `blob_url` (large.webp) and the variant URLs needed by the
 * srcset/preload pipeline.
 */
export async function processAndStorePhoto(
  input: ProcessAndStorePhotoInput
): Promise<ProcessAndStorePhotoResult> {
  const processed = await processImage(input.buffer)
  const photoId = randomUUID()

  const thumbnailBlob = await put(
    `photos/${photoId}/thumbnail.webp`,
    processed.thumbnail,
    { access: 'public', contentType: 'image/webp' }
  )

  let thumbnail2xUrl: string | null = null
  if (processed.thumbnail2x) {
    const blob = await put(
      `photos/${photoId}/thumbnail-2x.webp`,
      processed.thumbnail2x,
      { access: 'public', contentType: 'image/webp' }
    )
    thumbnail2xUrl = blob.url
  }

  let mediumUrl: string | null = null
  if (processed.medium) {
    const blob = await put(`photos/${photoId}/medium.webp`, processed.medium, {
      access: 'public',
      contentType: 'image/webp',
    })
    mediumUrl = blob.url
  }

  const largeBlob = await put(`photos/${photoId}/large.webp`, processed.large, {
    access: 'public',
    contentType: 'image/webp',
  })

  let large4kUrl: string | null = null
  if (processed.large4k) {
    const blob = await put(
      `photos/${photoId}/large-4k.webp`,
      processed.large4k,
      { access: 'public', contentType: 'image/webp' }
    )
    large4kUrl = blob.url
  }

  // Merge variant URLs alongside any caller-supplied XMP/EXIF so capture
  // metadata isn't dropped. Variant keys take precedence — we always trust
  // the URLs we just wrote.
  const xmpMetadata = {
    ...(input.extraXmpMetadata ?? {}),
    thumbnail_url: thumbnailBlob.url,
    thumbnail_2x_url: thumbnail2xUrl,
    medium_url: mediumUrl,
    large_4k_url: large4kUrl,
  }
  const variants = {
    thumbnail_url: thumbnailBlob.url,
    thumbnail_2x_url: thumbnail2xUrl,
    medium_url: mediumUrl,
    large_4k_url: large4kUrl,
  }

  const labels = input.labels ?? []

  await sql`
    INSERT INTO photos (
      id, event_id, band_id, photographer,
      blob_url, blob_pathname, original_filename,
      width, height, file_size, content_type,
      xmp_metadata, labels, visibility,
      uploaded_at, captured_at
    ) VALUES (
      ${photoId},
      ${input.eventId ?? null},
      ${input.bandId ?? null},
      ${input.photographer ?? null},
      ${largeBlob.url},
      ${`photos/${photoId}/large.webp`},
      ${input.filename},
      ${processed.width},
      ${processed.height},
      ${processed.fileSize},
      ${`image/${processed.format}`},
      ${JSON.stringify(xmpMetadata)}::jsonb,
      ${labels}::text[],
      ${input.visibility ?? 'private'},
      NOW(),
      ${input.capturedAt ?? null}::timestamp with time zone
    )
  `

  return {
    photoId,
    blobUrl: largeBlob.url,
    width: processed.width,
    height: processed.height,
    variants,
  }
}
