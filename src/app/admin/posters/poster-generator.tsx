'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, FileDropzone } from '@/components/ui'
import { AdminFormField, AdminInput, AdminSelect } from '@/components/ui'
import { DownloadIcon } from '@/components/icons'
import type { Band, Event, Photo } from '@/lib/db-types'
import { formatEventDateLabel } from '@/lib/date-utils'
import { coverSlack, loadImage } from '@/lib/canvas'
import { loadJostFont } from '../thumbnails/jost-font'
import {
  composePoster,
  POSTER_FORMATS,
  type LogoCorner,
  type PosterDimensions,
  type PosterFormat,
} from './compose'

const BOTTB_LOGO_SRC = '/images/logos/bottb-square-black.png'
const YOUNGCARE_LOGO_SRC = '/images/logos/youngcare.png'

interface PosterGeneratorProps {
  events: Event[]
}

/** Load an image with anonymous CORS so a cross-origin photo won't taint the canvas. */
function loadCorsImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** The best available URL for a stored photo (prefer higher resolution). */
function bestPhotoUrl(photo: Photo): string {
  return photo.large_4k_url || photo.medium_url || photo.blob_url
}

/** Every company logo a band is made up of (multi-company bands, or the legacy single company). */
function bandLogoUrls(band: Band): { slug: string; url: string }[] {
  if (band.companies?.length) {
    return band.companies
      .filter((c) => c.logo_url)
      .map((c) => ({ slug: c.slug, url: c.logo_url as string }))
  }
  if (band.company_slug && band.company_logo_url) {
    return [{ slug: band.company_slug, url: band.company_logo_url }]
  }
  return []
}

/** Every distinct company logo competing at an event, in band order. */
function eventCompanyLogoUrls(bands: Band[]): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  for (const band of bands) {
    for (const { slug, url } of bandLogoUrls(band)) {
      if (seen.has(slug)) continue
      seen.add(slug)
      urls.push(url)
    }
  }
  return urls
}

const PORTRAIT = POSTER_FORMATS.portrait

/**
 * Crisp on-screen preview: match the canvas's bitmap resolution to its
 * displayed CSS size (at the device pixel ratio) instead of the full
 * export resolution. Painting text natively at the displayed size avoids the
 * browser downscaling a much larger bitmap, which aliases fine strokes into
 * a "pixelated" look. The full-resolution export (`downloadFormat`) is
 * unaffected — it always renders off-screen at `POSTER_FORMATS[format]`.
 */
function usePreviewSize(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  format: PosterFormat
): PosterDimensions {
  const aspect = POSTER_FORMATS[format].w / POSTER_FORMATS[format].h
  const [size, setSize] = useState<PosterDimensions>(POSTER_FORMATS[format])

  useEffect(() => {
    const el = canvasRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const update = (cssWidth: number) => {
      if (!cssWidth) return
      const dpr = window.devicePixelRatio || 1
      const w = Math.round(cssWidth * dpr)
      const h = Math.round(w / aspect)
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    }

    update(el.getBoundingClientRect().width)
    const observer = new ResizeObserver(([entry]) =>
      update(entry.contentRect.width)
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [canvasRef, aspect])

  return size
}

export function PosterGenerator({ events }: PosterGeneratorProps) {
  const portraitRef = useRef<HTMLCanvasElement>(null)
  const landscapeRef = useRef<HTMLCanvasElement>(null)
  const fbcoverRef = useRef<HTMLCanvasElement>(null)

  const portraitSize = usePreviewSize(portraitRef, 'portrait')
  const landscapeSize = usePreviewSize(landscapeRef, 'landscape')
  const fbcoverSize = usePreviewSize(fbcoverRef, 'fbcover')

  const [eventId, setEventId] = useState('')
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [venue, setVenue] = useState('')
  const [bottbCorner, setBottbCorner] = useState<LogoCorner>('top-right')

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoObjectUrl, setPhotoObjectUrl] = useState<string | null>(null)
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [focusX, setFocusX] = useState(0.5)
  const [focusY, setFocusY] = useState(0.5)

  // Which event's photos the picker browses — defaults to the poster's event
  // but can be pointed at any past event to reuse an older hero shot.
  const [photoEventId, setPhotoEventId] = useState('')
  const [eventPhotos, setEventPhotos] = useState<Photo[]>([])
  // Which event the loaded `eventPhotos` belong to; lets us derive the loading
  // state without a synchronous setState in the fetch effect.
  const [photosEventId, setPhotosEventId] = useState<string | null>(null)

  const [bottbLogo, setBottbLogo] = useState<HTMLImageElement | null>(null)
  const [partnerLogo, setPartnerLogo] = useState<HTMLImageElement | null>(null)
  const [youngcareLogo, setYoungcareLogo] = useState<HTMLImageElement | null>(
    null
  )
  const [companyLogos, setCompanyLogos] = useState<HTMLImageElement[]>([])
  const [fontReady, setFontReady] = useState(false)

  const selectedEvent = events.find((e) => e.id === eventId) ?? null
  const partner = selectedEvent?.info?.national_partner ?? null
  const photosLoading = Boolean(photoEventId) && photosEventId !== photoEventId

  // Load the Bottb square logo, the Youngcare logo + website font once.
  useEffect(() => {
    loadImage(BOTTB_LOGO_SRC)
      .then(setBottbLogo)
      .catch(() => {})
    loadImage(YOUNGCARE_LOGO_SRC)
      .then(setYoungcareLogo)
      .catch(() => {})
    loadJostFont()
      .then(() => setFontReady(true))
      .catch(() => setFontReady(true))
  }, [])

  // Load the national-partner logo through the same-origin proxy (arbitrary
  // external URL, may lack CORS headers).
  useEffect(() => {
    let cancelled = false
    const logoUrl = partner?.logo_url
    const pending = logoUrl
      ? loadImage(
          `/api/admin/thumbnails/logo-proxy?url=${encodeURIComponent(logoUrl)}`
        )
      : Promise.resolve(null)

    pending
      .then((img) => {
        if (!cancelled) setPartnerLogo(img)
      })
      .catch(() => {
        if (!cancelled) setPartnerLogo(null)
      })

    return () => {
      cancelled = true
    }
  }, [partner?.logo_url])

  // Load the competing bands' company logos for the footer strip, deduped
  // and proxied the same way as the partner logo.
  useEffect(() => {
    let cancelled = false
    const pending: Promise<Band[]> = eventId
      ? fetch(`/api/bands/${eventId}`).then((res) => (res.ok ? res.json() : []))
      : Promise.resolve([])

    pending
      .then((bands) => {
        const urls = eventCompanyLogoUrls(bands)
        return Promise.all(
          urls.map((url) =>
            loadImage(
              `/api/admin/thumbnails/logo-proxy?url=${encodeURIComponent(url)}`
            ).catch(() => null)
          )
        )
      })
      .then((logos) => {
        if (cancelled) return
        setCompanyLogos(
          logos.filter((img): img is HTMLImageElement => img !== null)
        )
      })
      .catch(() => {
        if (!cancelled) setCompanyLogos([])
      })

    return () => {
      cancelled = true
    }
  }, [eventId])

  // Fetch the browsed event's photos for the picker. (The grid only renders
  // when an event is chosen, so we needn't clear the list when it's empty.)
  useEffect(() => {
    if (!photoEventId) return
    let cancelled = false
    const targetId = photoEventId
    fetch(`/api/photos?event=${targetId}&limit=100&skipMeta=true`)
      .then((res) => (res.ok ? res.json() : { photos: [] }))
      .then((data: { photos?: Photo[] }) => {
        if (cancelled) return
        setEventPhotos(data.photos ?? [])
        setPhotosEventId(targetId)
      })
      .catch(() => {
        if (cancelled) return
        setEventPhotos([])
        setPhotosEventId(targetId)
      })

    return () => {
      cancelled = true
    }
  }, [photoEventId])

  // Clean up an uploaded object URL when it changes / unmounts.
  useEffect(() => {
    return () => {
      if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl)
    }
  }, [photoObjectUrl])

  // Redraw all three previews whenever any input changes.
  const draw = useCallback(() => {
    const content = {
      name,
      date,
      venue,
      bottbLogo,
      partnerLogo,
      youngcareLogo,
      companyLogos,
      bottbCorner,
    }
    const sw = photo?.naturalWidth ?? 0
    const sh = photo?.naturalHeight ?? 0
    const source = photo

    const targets: [
      React.RefObject<HTMLCanvasElement | null>,
      PosterFormat,
      PosterDimensions,
    ][] = [
      [portraitRef, 'portrait', portraitSize],
      [landscapeRef, 'landscape', landscapeSize],
      [fbcoverRef, 'fbcover', fbcoverSize],
    ]
    for (const [ref, format, dimensions] of targets) {
      const ctx = ref.current?.getContext('2d')
      if (ctx) {
        composePoster(ctx, source, sw, sh, content, {
          format,
          focusX,
          focusY,
          dimensions,
        })
      }
    }
  }, [
    name,
    date,
    venue,
    bottbLogo,
    partnerLogo,
    youngcareLogo,
    companyLogos,
    bottbCorner,
    photo,
    focusX,
    focusY,
    portraitSize,
    landscapeSize,
    fbcoverSize,
  ])

  useEffect(() => {
    draw()
  }, [draw, fontReady])

  const handleEventChange = (id: string) => {
    setEventId(id)
    setPhotoEventId(id)
    const event = events.find((e) => e.id === id)
    if (event) {
      setName(event.name)
      setDate(formatEventDateLabel(event.date, event.timezone, event.info))
      setVenue(event.location)
    }
  }

  const setPhotoFromImage = (img: HTMLImageElement) => {
    setPhoto(img)
    setFocusX(0.5)
    setFocusY(0.5)
    setPhotoError(null)
  }

  const handleUpload = (file: File | null) => {
    if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl)
    setPhotoFile(file)
    if (!file) {
      setPhotoObjectUrl(null)
      setPhoto(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPhotoObjectUrl(url)
    loadCorsImage(url)
      .then(setPhotoFromImage)
      .catch(() => setPhotoError('Could not load this image.'))
  }

  const handlePickEventPhoto = (p: Photo) => {
    // Clear any uploaded file so the source is unambiguous.
    if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl)
    setPhotoObjectUrl(null)
    setPhotoFile(null)
    loadCorsImage(bestPhotoUrl(p))
      .then(setPhotoFromImage)
      .catch(() =>
        setPhotoError('Could not load that photo (CORS). Try uploading it.')
      )
  }

  // --- Portrait crop drag-to-reposition -------------------------------------
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    focusX: number
    focusY: number
  } | null>(null)

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!photo) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      focusX,
      focusY,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag || !photo) return
    const rect = e.currentTarget.getBoundingClientRect()
    const { slackX, slackY } = coverSlack(
      photo.naturalWidth,
      photo.naturalHeight,
      PORTRAIT.w,
      PORTRAIT.h
    )
    // Dragging right reveals more of the left of the photo → focus decreases.
    if (slackX > 0 && rect.width) {
      const dxCanvas = ((e.clientX - drag.startX) * PORTRAIT.w) / rect.width
      setFocusX(clamp(drag.focusX - dxCanvas / slackX, 0, 1))
    }
    if (slackY > 0 && rect.height) {
      const dyCanvas = ((e.clientY - drag.startY) * PORTRAIT.h) / rect.height
      setFocusY(clamp(drag.focusY - dyCanvas / slackY, 0, 1))
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null
    }
  }

  const triggerDownload = (blob: Blob | null, filename: string) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // Render a format at full resolution off-screen and download it as JPEG.
  const downloadFormat = (format: PosterFormat) => {
    if (!photo) return
    const { w, h } = POSTER_FORMATS[format]
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    composePoster(
      ctx,
      photo,
      photo.naturalWidth,
      photo.naturalHeight,
      {
        name,
        date,
        venue,
        bottbLogo,
        partnerLogo,
        youngcareLogo,
        companyLogos,
        bottbCorner,
      },
      { format, focusX, focusY }
    )
    const base = slugify(name || selectedEvent?.name || 'event')
    canvas.toBlob(
      (blob) => triggerDownload(blob, `${base}-poster-${format}.jpg`),
      'image/jpeg',
      0.92
    )
  }

  const hasPhoto = Boolean(photo)
  const portraitSlack = photo
    ? coverSlack(
        photo.naturalWidth,
        photo.naturalHeight,
        PORTRAIT.w,
        PORTRAIT.h
      )
    : { slackX: 0, slackY: 0 }
  const canPan = portraitSlack.slackX > 1 || portraitSlack.slackY > 1

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      {/* ---------------- Controls ---------------- */}
      <div className="space-y-6">
        <Card padding="md" className="space-y-4">
          <h2 className="text-lg font-semibold text-white">1. Event</h2>
          <AdminFormField label="Event">
            <AdminSelect
              value={eventId}
              onChange={(e) => handleEventChange(e.target.value)}
            >
              <option value="">— Select an event —</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </AdminSelect>
          </AdminFormField>
          <p className="text-xs text-gray-500">
            Selecting an event fills in the details below and loads its photos.
          </p>
        </Card>

        <Card padding="md" className="space-y-4">
          <h2 className="text-lg font-semibold text-white">2. Photo</h2>

          {events.length > 0 && (
            <AdminFormField label="Browse photos from">
              <AdminSelect
                value={photoEventId}
                onChange={(e) => setPhotoEventId(e.target.value)}
              >
                <option value="">— Select an event —</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </AdminSelect>
            </AdminFormField>
          )}

          {photoEventId && (
            <div className="space-y-2">
              {photosLoading ? (
                <p className="text-sm text-gray-500">Loading photos…</p>
              ) : eventPhotos.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No photos for this event — upload one below.
                </p>
              ) : (
                <div className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto">
                  {eventPhotos.map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={p.id}
                      src={p.thumbnail_url || p.blob_url}
                      alt={p.original_filename ?? 'Event photo'}
                      onClick={() => handlePickEventPhoto(p)}
                      className="aspect-square w-full cursor-pointer rounded border border-white/10 object-cover opacity-80 transition hover:opacity-100"
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <FileDropzone
            accept="image/*"
            file={photoFile}
            onFileSelect={handleUpload}
            label="Or upload a photo"
            placeholder="Drop a photo or click to choose"
            helperText="Stays on your machine — nothing is uploaded."
          />
          {photoError && <p className="text-sm text-error">{photoError}</p>}
        </Card>

        <Card padding="md" className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            3. Text &amp; branding
          </h2>
          <AdminFormField label="Event edition">
            <AdminInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sydney Tech Battle 2025"
            />
          </AdminFormField>
          <p className="text-xs text-gray-500">
            &ldquo;Battle of the Tech Bands&rdquo; is always shown as the
            headline; this line appears as the subtitle beneath it.
          </p>
          <AdminFormField label="Date">
            <AdminInput
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="e.g. 23rd October 2025 @ 6:30PM"
            />
          </AdminFormField>
          <AdminFormField label="Venue">
            <AdminInput
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="e.g. Factory Theatre, Sydney"
            />
          </AdminFormField>

          <AdminFormField label="Logo layout">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={
                  bottbCorner === 'top-right' ? 'accent' : 'outline-solid'
                }
                onClick={() => setBottbCorner('top-right')}
              >
                Bottb top-right
              </Button>
              <Button
                type="button"
                size="sm"
                variant={
                  bottbCorner === 'top-left' ? 'accent' : 'outline-solid'
                }
                onClick={() => setBottbCorner('top-left')}
              >
                Bottb top-left
              </Button>
            </div>
          </AdminFormField>
          {partner && (
            <p className="text-xs text-gray-500">
              Powered-by logo:{' '}
              <span className="text-gray-300">{partner.name}</span>
              {!partnerLogo && ' (could not load)'}
            </p>
          )}
          <p className="text-xs text-gray-500">
            Supporting Youngcare logo
            {!youngcareLogo && ' (could not load)'}
          </p>
          {companyLogos.length > 0 && (
            <p className="text-xs text-gray-500">
              Band logos: {companyLogos.length} loaded
            </p>
          )}
        </Card>
      </div>

      {/* ---------------- Previews ---------------- */}
      <div className="space-y-6">
        <Card padding="md" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-white">
              Portrait 4:5 · {PORTRAIT.w}×{PORTRAIT.h}
            </h2>
            <Button
              size="sm"
              variant="accent"
              disabled={!hasPhoto}
              onClick={() => downloadFormat('portrait')}
            >
              <DownloadIcon className="mr-1.5 h-4 w-4" />
              Portrait
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            {!hasPhoto
              ? 'Pick or upload a photo to start.'
              : canPan
                ? 'Drag the preview to reposition the photo.'
                : 'Photo fills the frame.'}
          </p>
          <div className="relative mx-auto w-full max-w-[300px]">
            <canvas
              ref={portraitRef}
              width={portraitSize.w}
              height={portraitSize.h}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`block w-full touch-none rounded-lg border border-white/10 bg-black ${
                canPan ? 'cursor-grab active:cursor-grabbing' : ''
              }`}
            />
          </div>
        </Card>

        <Card padding="md" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-white">
              Landscape 1.91:1 · {POSTER_FORMATS.landscape.w}×
              {POSTER_FORMATS.landscape.h}
            </h2>
            <Button
              size="sm"
              variant="accent"
              disabled={!hasPhoto}
              onClick={() => downloadFormat('landscape')}
            >
              <DownloadIcon className="mr-1.5 h-4 w-4" />
              Landscape
            </Button>
          </div>
          <canvas
            ref={landscapeRef}
            width={landscapeSize.w}
            height={landscapeSize.h}
            className="w-full rounded-lg border border-white/10 bg-black"
          />
        </Card>

        <Card padding="md" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-white">
              Facebook event cover · {POSTER_FORMATS.fbcover.w}×
              {POSTER_FORMATS.fbcover.h}
            </h2>
            <Button
              size="sm"
              variant="accent"
              disabled={!hasPhoto}
              onClick={() => downloadFormat('fbcover')}
            >
              <DownloadIcon className="mr-1.5 h-4 w-4" />
              FB cover
            </Button>
          </div>
          <canvas
            ref={fbcoverRef}
            width={fbcoverSize.w}
            height={fbcoverSize.h}
            className="w-full rounded-lg border border-white/10 bg-black"
          />
        </Card>
      </div>
    </div>
  )
}
