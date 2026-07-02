'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, FileDropzone } from '@/components/ui'
import { AdminFormField, AdminInput, AdminSelect } from '@/components/ui'
import { DownloadIcon } from '@/components/icons'
import type { Event, Photo } from '@/lib/db-types'
import { formatEventDateLabel } from '@/lib/date-utils'
import { coverSlack, loadImage } from '@/lib/canvas'
import { loadJostFont } from '../thumbnails/jost-font'
import {
  composePoster,
  POSTER_FORMATS,
  type LogoCorner,
  type PosterFormat,
} from './compose'

const BOTTB_LOGO_SRC = '/images/logos/bottb-square-black.png'

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

const PORTRAIT = POSTER_FORMATS.portrait

export function PosterGenerator({ events }: PosterGeneratorProps) {
  const portraitRef = useRef<HTMLCanvasElement>(null)
  const landscapeRef = useRef<HTMLCanvasElement>(null)
  const fbcoverRef = useRef<HTMLCanvasElement>(null)

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

  const [eventPhotos, setEventPhotos] = useState<Photo[]>([])
  // Which event the loaded `eventPhotos` belong to; lets us derive the loading
  // state without a synchronous setState in the fetch effect.
  const [photosEventId, setPhotosEventId] = useState<string | null>(null)

  const [bottbLogo, setBottbLogo] = useState<HTMLImageElement | null>(null)
  const [partnerLogo, setPartnerLogo] = useState<HTMLImageElement | null>(null)
  const [fontReady, setFontReady] = useState(false)

  const selectedEvent = events.find((e) => e.id === eventId) ?? null
  const partner = selectedEvent?.info?.national_partner ?? null
  const photosLoading = Boolean(eventId) && photosEventId !== eventId

  // Load the Bottb square logo + website font once.
  useEffect(() => {
    loadImage(BOTTB_LOGO_SRC)
      .then(setBottbLogo)
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

  // Fetch this event's photos for the picker. (The grid only renders when an
  // event is selected, so we needn't clear the list when eventId is empty.)
  useEffect(() => {
    if (!eventId) return
    let cancelled = false
    const targetId = eventId
    fetch(`/api/photos?event=${eventId}&limit=100&skipMeta=true`)
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
  }, [eventId])

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
      bottbCorner,
    }
    const sw = photo?.naturalWidth ?? 0
    const sh = photo?.naturalHeight ?? 0
    const source = photo

    const targets: [React.RefObject<HTMLCanvasElement | null>, PosterFormat][] =
      [
        [portraitRef, 'portrait'],
        [landscapeRef, 'landscape'],
        [fbcoverRef, 'fbcover'],
      ]
    for (const [ref, format] of targets) {
      const ctx = ref.current?.getContext('2d')
      if (ctx) {
        composePoster(ctx, source, sw, sh, content, { format, focusX, focusY })
      }
    }
  }, [
    name,
    date,
    venue,
    bottbLogo,
    partnerLogo,
    bottbCorner,
    photo,
    focusX,
    focusY,
  ])

  useEffect(() => {
    draw()
  }, [draw, fontReady])

  const handleEventChange = (id: string) => {
    setEventId(id)
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
      { name, date, venue, bottbLogo, partnerLogo, bottbCorner },
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

          {eventId && (
            <div className="space-y-2">
              <p className="text-sm text-gray-300">From this event</p>
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
          <AdminFormField label="Event name">
            <AdminInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Battle of the Tech Bands"
            />
          </AdminFormField>
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
              width={PORTRAIT.w}
              height={PORTRAIT.h}
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
            width={POSTER_FORMATS.landscape.w}
            height={POSTER_FORMATS.landscape.h}
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
            width={POSTER_FORMATS.fbcover.w}
            height={POSTER_FORMATS.fbcover.h}
            className="w-full rounded-lg border border-white/10 bg-black"
          />
        </Card>
      </div>
    </div>
  )
}
