'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AdminFormField,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  Button,
  Card,
  FileDropzone,
  Tabs,
} from '@/components/ui'
import { DownloadIcon } from '@/components/icons'
import type { Band, Event } from '@/lib/db-types'
import { formatEventDateLabel } from '@/lib/date-utils'
import { loadImage } from '@/lib/canvas'
import {
  composeCreditsOverlay,
  composeCreditsPreview,
  composeTitleOverlay,
  composeTitlePreview,
  OV_H,
  OV_W,
  PV_H,
  PV_W,
  type LogoCorner,
} from './compose'
import { loadJostFont } from '../thumbnails/jost-font'
import { useKeyframes } from '../thumbnails/use-keyframes'
import { useVideoScrubber, SCRUB_FRAME } from '../thumbnails/use-video-scrubber'

const BOTTB_LOGO_SRC = '/images/logos/bottb-square-black.png'
const YOUNGCARE_LOGO_SRC = '/images/logos/youngcare.png'

interface BandSetGeneratorProps {
  events: Event[]
}

type Mode = 'title' | 'credits'

const TABS = [
  { id: 'title' as const, label: 'Title page' },
  { id: 'credits' as const, label: 'Credits page' },
]

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00.0'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const t = Math.floor((seconds * 10) % 10)
  return `${m}:${s.toString().padStart(2, '0')}.${t}`
}

/** The band's primary company logo (multi-company bands, or the legacy single company). */
function bandLogoUrl(band: Band): string | undefined {
  return (
    band.companies?.find((c) => c.logo_url)?.logo_url ?? band.company_logo_url
  )
}

/** Drop a trailing "@ 6:30PM"-style time — the title card only needs the date. */
function stripTime(label: string): string {
  return label.replace(/\s*@\s*\d{1,2}:\d{2}\s*[AaPp]\.?[Mm]\.?$/, '').trim()
}

export function BandSetGenerator({ events }: BandSetGeneratorProps) {
  const [mode, setMode] = useState<Mode>('title')

  const [eventId, setEventId] = useState('')
  const [bands, setBands] = useState<Band[]>([])
  const [bandId, setBandId] = useState('')

  const [bandName, setBandName] = useState('')
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventVenue, setEventVenue] = useState('')
  const [membersText, setMembersText] = useState('')
  const [bottbCorner, setBottbCorner] = useState<LogoCorner>('top-right')

  const [bottbLogo, setBottbLogo] = useState<HTMLImageElement | null>(null)
  const [companyLogo, setCompanyLogo] = useState<HTMLImageElement | null>(null)
  const [partnerLogo, setPartnerLogo] = useState<HTMLImageElement | null>(null)
  const [youngcareLogo, setYoungcareLogo] = useState<HTMLImageElement | null>(
    null
  )
  const [logoError, setLogoError] = useState<string | null>(null)
  const [fontReady, setFontReady] = useState(false)

  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(
    null
  )

  const videoRef = useRef<HTMLVideoElement>(null)
  const scrubber = useVideoScrubber(videoRef)
  const keyframes = useKeyframes(scrubber.videoUrl)

  // Load the Bottb square logo, the Youngcare logo, + website font once.
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

  // Load the bands competing at the selected event.
  useEffect(() => {
    if (!eventId) {
      // Clear asynchronously to avoid a synchronous setState in the effect body.
      Promise.resolve().then(() => setBands([]))
      return
    }
    let cancelled = false
    fetch(`/api/bands/${eventId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Band[]) => {
        if (!cancelled) setBands(data)
      })
      .catch(() => {
        if (!cancelled) setBands([])
      })
    return () => {
      cancelled = true
    }
  }, [eventId])

  const selectedEvent = events.find((e) => e.id === eventId) ?? null
  const partner = selectedEvent?.info?.national_partner ?? null

  // Load the event's national-partner "Powered by" logo (e.g. Jumbo
  // Interactive) through the same-origin proxy (arbitrary external URL, may
  // lack CORS headers).
  useEffect(() => {
    let cancelled = false
    const logoUrl = selectedEvent?.info?.national_partner?.logo_url
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
  }, [selectedEvent?.info?.national_partner?.logo_url])

  const selectedBand = bands.find((b) => b.id === bandId) ?? null

  // Load the selected band's company logo through the same-origin proxy.
  useEffect(() => {
    let cancelled = false
    const logoUrl = selectedBand ? bandLogoUrl(selectedBand) : undefined
    const pending = logoUrl
      ? loadImage(
          `/api/admin/thumbnails/logo-proxy?url=${encodeURIComponent(logoUrl)}`
        )
      : Promise.resolve(null)

    pending
      .then((img) => {
        if (cancelled) return
        setCompanyLogo(img)
        setLogoError(null)
      })
      .catch(() => {
        if (cancelled) return
        setCompanyLogo(null)
        setLogoError('Could not load this band logo.')
      })

    return () => {
      cancelled = true
    }
  }, [selectedBand])

  // Redraw the preview whenever any input changes.
  const draw = useCallback(() => {
    const canvas = previewCanvas
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    const video = videoRef.current
    const source = scrubber.videoReady && video ? video : null
    const sw = video?.videoWidth ?? 0
    const sh = video?.videoHeight ?? 0
    const logos = {
      bottbLogo,
      companyLogo,
      bottbCorner,
      partnerLogo,
      youngcareLogo,
    }

    if (mode === 'title') {
      composeTitlePreview(ctx, source, sw, sh, {
        ...logos,
        bandName,
        eventName,
        eventDate,
        eventVenue,
      })
    } else {
      composeCreditsPreview(ctx, source, sw, sh, {
        ...logos,
        bandName,
        members: membersText.split('\n'),
      })
    }
  }, [
    previewCanvas,
    scrubber.videoReady,
    mode,
    bottbLogo,
    companyLogo,
    partnerLogo,
    youngcareLogo,
    bottbCorner,
    bandName,
    eventName,
    eventDate,
    eventVenue,
    membersText,
  ])

  useEffect(() => {
    draw()
  }, [draw, scrubber.frameTick, fontReady])

  const handleEventChange = (id: string) => {
    setEventId(id)
    setBandId('')
    const event = events.find((e) => e.id === id)
    if (event) {
      setEventName(event.name)
      setEventDate(
        stripTime(formatEventDateLabel(event.date, event.timezone, event.info))
      )
      setEventVenue(event.location)
    }
  }

  const handleBandChange = (id: string) => {
    setBandId(id)
    const band = bands.find((b) => b.id === id)
    if (band) {
      setBandName(band.name)
      setMembersText((band.info?.members ?? []).join('\n'))
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

  const buildName = (suffix: string) => {
    const base =
      selectedBand?.name || (bandName ? slugify(bandName) : 'band-set')
    return `${slugify(base)}-${suffix}.png`
  }

  // Transparent 4K PNG of just the logos + text, for compositing over the
  // start of the full-set video. Rendered off-screen so we never mount a 4K
  // canvas for the on-screen preview.
  const downloadOverlay = () => {
    const canvas = document.createElement('canvas')
    canvas.width = OV_W
    canvas.height = OV_H
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const logos = {
      bottbLogo,
      companyLogo,
      bottbCorner,
      partnerLogo,
      youngcareLogo,
    }

    if (mode === 'title') {
      composeTitleOverlay(ctx, {
        ...logos,
        bandName,
        eventName,
        eventDate,
        eventVenue,
      })
    } else {
      composeCreditsOverlay(ctx, {
        ...logos,
        bandName,
        members: membersText.split('\n'),
      })
    }
    canvas.toBlob(
      (blob) => triggerDownload(blob, buildName(`${mode}-overlay-4k`)),
      'image/png'
    )
  }

  const hasVideo = Boolean(scrubber.videoUrl)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      {scrubber.videoUrl && (
        <video
          ref={videoRef}
          src={scrubber.videoUrl}
          muted
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          onLoadedMetadata={scrubber.onLoadedMetadata}
          onSeeked={scrubber.onSeeked}
          onLoadedData={scrubber.onLoadedData}
          className="pointer-events-none absolute h-px w-px opacity-0"
          aria-hidden
        />
      )}

      {/* ---------------- Controls ---------------- */}
      <div className="space-y-6">
        <Card padding="md" className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            1. Reference video
          </h2>
          <FileDropzone
            accept="video/*"
            file={scrubber.videoFile}
            onFileSelect={scrubber.selectVideo}
            label="Full-set video"
            placeholder="Drop a video or click to choose"
            helperText="Stays on your machine — used only to preview the overlay against real footage."
          />
        </Card>

        <Card padding="md" className="space-y-4">
          <h2 className="text-lg font-semibold text-white">2. Event & band</h2>
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

          {eventId && (
            <AdminFormField label="Band">
              <AdminSelect
                value={bandId}
                onChange={(e) => handleBandChange(e.target.value)}
              >
                <option value="">— Select a band —</option>
                {bands.map((band) => (
                  <option key={band.id} value={band.id}>
                    {band.name}
                  </option>
                ))}
              </AdminSelect>
            </AdminFormField>
          )}
          {logoError && <p className="text-sm text-error">{logoError}</p>}

          {partner && (
            <p className="text-xs text-gray-500">
              Powered-by logo:{' '}
              <span className="text-gray-300">{partner.name}</span>
              {!partnerLogo && ' (could not load)'}
            </p>
          )}
          <p className="text-xs text-gray-500">
            Supporting Youngcare logo{!youngcareLogo && ' (could not load)'}
          </p>

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
        </Card>

        <Card padding="md" className="space-y-4">
          <Tabs
            tabs={TABS}
            activeTab={mode}
            onTabChange={(id) => setMode(id as Mode)}
            aria-label="Overlay type"
          />

          {mode === 'title' ? (
            <div className="space-y-4">
              <AdminFormField label="Band name">
                <AdminInput
                  value={bandName}
                  onChange={(e) => setBandName(e.target.value)}
                  placeholder="e.g. The Null Pointers"
                />
              </AdminFormField>
              <AdminFormField label="Event name">
                <AdminInput
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g. Sydney Tech Battle 2025"
                />
              </AdminFormField>
              <AdminFormField label="Date">
                <AdminInput
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  placeholder="e.g. 23rd October 2025"
                />
              </AdminFormField>
              <AdminFormField label="Venue">
                <AdminInput
                  value={eventVenue}
                  onChange={(e) => setEventVenue(e.target.value)}
                  placeholder="e.g. Factory Theatre, Sydney"
                />
              </AdminFormField>
            </div>
          ) : (
            <div className="space-y-4">
              <AdminFormField label="Band name">
                <AdminInput
                  value={bandName}
                  onChange={(e) => setBandName(e.target.value)}
                  placeholder="e.g. The Null Pointers"
                />
              </AdminFormField>
              <AdminFormField
                label="Band members"
                helperText="One per line, e.g. &ldquo;Jane Doe — Vocals&rdquo;. Pre-filled from the band's saved lineup when available."
              >
                <AdminTextarea
                  value={membersText}
                  onChange={(e) => setMembersText(e.target.value)}
                  placeholder={'Jane Doe — Vocals\nJohn Smith — Guitar'}
                  rows={8}
                />
              </AdminFormField>
            </div>
          )}
        </Card>
      </div>

      {/* ---------------- Preview ---------------- */}
      <div className="space-y-6">
        <Card padding="md" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-white">
              {mode === 'title' ? 'Title page' : 'Credits page'} · {PV_W}×{PV_H}
            </h2>
            <Button
              size="sm"
              variant="outline-solid"
              disabled={!fontReady}
              title="Transparent 4K PNG of the logos + text, to composite over the start of the full-set video"
              onClick={downloadOverlay}
            >
              <DownloadIcon className="mr-1.5 h-4 w-4" />
              Overlay 4K
            </Button>
          </div>

          <canvas
            ref={setPreviewCanvas}
            width={PV_W}
            height={PV_H}
            className="w-full rounded-lg border border-white/10 bg-black"
          />

          {!hasVideo ? (
            <p className="text-sm text-gray-400">
              Add a reference video to preview the overlay against real footage
              (optional — the exported PNG never includes it).
            </p>
          ) : (
            <div className="space-y-3">
              {keyframes.length > 0 && (
                <div className="flex gap-1 overflow-x-auto">
                  {keyframes.map((kf) => {
                    const active =
                      Math.abs(kf.time - scrubber.scrubTime) <
                      (scrubber.duration || 1) / 20
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={kf.time}
                        src={kf.url}
                        alt={`Frame at ${formatTime(kf.time)}`}
                        onClick={() => scrubber.requestSeek(kf.time)}
                        className={`h-12 w-auto shrink-0 cursor-pointer rounded border transition ${
                          active
                            ? 'border-accent opacity-100'
                            : 'border-white/10 opacity-70 hover:opacity-100'
                        }`}
                      />
                    )
                  })}
                </div>
              )}

              <input
                type="range"
                min={0}
                max={scrubber.duration || 0}
                step={0.01}
                value={scrubber.scrubTime}
                onChange={(e) =>
                  scrubber.requestSeek(parseFloat(e.target.value))
                }
                disabled={!scrubber.duration}
                className="w-full accent-accent"
              />

              <div className="flex items-center justify-between text-sm text-gray-300">
                <span className="tabular-nums">
                  {formatTime(scrubber.scrubTime)}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline-solid"
                    onClick={() => scrubber.requestSeek(scrubber.scrubTime - 1)}
                  >
                    −1s
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-solid"
                    onClick={() =>
                      scrubber.requestSeek(scrubber.scrubTime - SCRUB_FRAME)
                    }
                  >
                    −1f
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-solid"
                    onClick={() =>
                      scrubber.requestSeek(scrubber.scrubTime + SCRUB_FRAME)
                    }
                  >
                    +1f
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-solid"
                    onClick={() => scrubber.requestSeek(scrubber.scrubTime + 1)}
                  >
                    +1s
                  </Button>
                </div>
                <span className="tabular-nums text-gray-500">
                  {formatTime(scrubber.duration)}
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
