'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, FileDropzone } from '@/components/ui'
import { AdminFormField, AdminInput, AdminSelect } from '@/components/ui'
import { DownloadIcon } from '@/components/icons'
import type { CompanyWithStats } from '@/lib/db-types'
import {
  composeInstagram,
  composeYouTube,
  coverSlack,
  IG_H,
  IG_W,
  YT_H,
  YT_W,
  type LogoCorner,
} from './compose'
import { loadJostFont } from './jost-font'
import { useKeyframes } from './use-keyframes'

const BOTTB_LOGO_SRC = '/images/logos/bottb-square-black.png'
const FRAME = 1 / 30 // assume ~30fps for single-frame stepping

interface ThumbnailGeneratorProps {
  companies: CompanyWithStats[]
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
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

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00.0'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const t = Math.floor((seconds * 10) % 10)
  return `${m}:${s.toString().padStart(2, '0')}.${t}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function ThumbnailGenerator({ companies }: ThumbnailGeneratorProps) {
  // Only companies with a usable logo can drive the top-left brand mark.
  const withLogos = companies.filter((c) => c.logo_url)

  const videoRef = useRef<HTMLVideoElement>(null)
  const ytCanvasRef = useRef<HTMLCanvasElement>(null)
  const igCanvasRef = useRef<HTMLCanvasElement>(null)

  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [duration, setDuration] = useState(0)
  // scrubTime tracks the slider thumb (immediate); currentTime tracks the
  // actually-decoded frame and is what drives a redraw.
  const [scrubTime, setScrubTime] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoReady, setVideoReady] = useState(false)
  const [videoDims, setVideoDims] = useState<{ w: number; h: number } | null>(
    null
  )

  const [companySlug, setCompanySlug] = useState('')
  const [artist, setArtist] = useState('')
  const [song, setSong] = useState('')
  const [bottbCorner, setBottbCorner] = useState<LogoCorner>('top-right')

  // Instagram crop focal point (0..1 on each axis; 0.5 = centred).
  const [igFocusX, setIgFocusX] = useState(0.5)
  const [igFocusY, setIgFocusY] = useState(0.5)

  const [bottbLogo, setBottbLogo] = useState<HTMLImageElement | null>(null)
  const [companyLogo, setCompanyLogo] = useState<HTMLImageElement | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [fontReady, setFontReady] = useState(false)

  // Seek coalescing — never queue more than one pending seek so fast dragging
  // doesn't back up a long chain of decodes.
  const seekingRef = useRef(false)
  const pendingSeekRef = useRef<number | null>(null)

  const keyframes = useKeyframes(videoUrl)
  const selectedCompany = withLogos.find((c) => c.slug === companySlug) ?? null

  // Load the Bottb square logo + website font once.
  useEffect(() => {
    loadImage(BOTTB_LOGO_SRC)
      .then(setBottbLogo)
      .catch(() => {})
    loadJostFont()
      .then(() => setFontReady(true))
      .catch(() => setFontReady(true))
  }, [])

  // Load the selected company logo through the same-origin proxy. All state
  // updates happen inside the async callbacks to avoid cascading renders.
  useEffect(() => {
    let cancelled = false
    const logoUrl = selectedCompany?.logo_url
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
        setLogoError('Could not load this company logo.')
      })

    return () => {
      cancelled = true
    }
  }, [selectedCompany?.logo_url])

  // Clean up the object URL when the video changes / unmounts.
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
  }, [videoUrl])

  // Redraw both previews whenever any input changes.
  const draw = useCallback(() => {
    const video = videoRef.current
    const source = videoReady && video ? video : null
    const sw = video?.videoWidth ?? 0
    const sh = video?.videoHeight ?? 0

    const yt = ytCanvasRef.current?.getContext('2d')
    if (yt) {
      composeYouTube(yt, source, sw, sh, {
        artist,
        song,
        bottbLogo,
        companyLogo,
        bottbCorner,
      })
    }

    const ig = igCanvasRef.current?.getContext('2d')
    if (ig) {
      composeInstagram(ig, source, sw, sh, igFocusX, igFocusY)
    }
  }, [
    videoReady,
    artist,
    song,
    bottbLogo,
    companyLogo,
    bottbCorner,
    igFocusX,
    igFocusY,
  ])

  useEffect(() => {
    draw()
  }, [draw, currentTime, fontReady])

  const handleVideoSelect = (file: File | null) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    seekingRef.current = false
    pendingSeekRef.current = null
    setVideoReady(false)
    setVideoDims(null)
    setDuration(0)
    setScrubTime(0)
    setCurrentTime(0)
    setIgFocusX(0.5)
    setIgFocusY(0.5)
    setVideoFile(file)
    setVideoUrl(file ? URL.createObjectURL(file) : null)
  }

  const handleLoadedMetadata = () => {
    const video = videoRef.current
    if (!video) return
    setDuration(video.duration || 0)
    if (video.videoWidth && video.videoHeight) {
      setVideoDims({ w: video.videoWidth, h: video.videoHeight })
    }
  }

  // Coalesced seek: move the thumb immediately, but only ever have one decode
  // in flight; the most recent requested time wins.
  const requestSeek = (time: number) => {
    const video = videoRef.current
    if (!video || !duration) return
    const target = clamp(time, 0, duration)
    setScrubTime(target)
    if (seekingRef.current) {
      pendingSeekRef.current = target
    } else {
      seekingRef.current = true
      video.currentTime = target
    }
  }

  const handleSeeked = () => {
    const video = videoRef.current
    if (!video) return
    // Live feedback on every decoded frame.
    draw()
    const next = pendingSeekRef.current
    if (next != null && Math.abs(next - video.currentTime) > 0.001) {
      pendingSeekRef.current = null
      video.currentTime = next
    } else {
      seekingRef.current = false
      pendingSeekRef.current = null
      setCurrentTime(video.currentTime)
    }
  }

  const handleCompanyChange = (slug: string) => {
    setCompanySlug(slug)
    const company = withLogos.find((c) => c.slug === slug)
    if (company) setArtist(company.name)
  }

  // --- Instagram crop drag-to-reposition -----------------------------------
  const igDragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    focusX: number
    focusY: number
  } | null>(null)

  const handleIgPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!videoReady) return
    e.currentTarget.setPointerCapture(e.pointerId)
    igDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      focusX: igFocusX,
      focusY: igFocusY,
    }
  }

  const handleIgPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = igDragRef.current
    const video = videoRef.current
    if (!drag || !video) return
    const rect = e.currentTarget.getBoundingClientRect()
    const { slackX, slackY } = coverSlack(
      video.videoWidth,
      video.videoHeight,
      IG_W,
      IG_H
    )
    // Convert on-screen drag (px) to canvas px, then to a focal fraction.
    // Dragging right reveals more of the left of the frame → focus decreases.
    if (slackX > 0 && rect.width) {
      const dxCanvas = ((e.clientX - drag.startX) * IG_W) / rect.width
      setIgFocusX(clamp(drag.focusX - dxCanvas / slackX, 0, 1))
    }
    if (slackY > 0 && rect.height) {
      const dyCanvas = ((e.clientY - drag.startY) * IG_H) / rect.height
      setIgFocusY(clamp(drag.focusY - dyCanvas / slackY, 0, 1))
    }
  }

  const handleIgPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (igDragRef.current?.pointerId === e.pointerId) {
      igDragRef.current = null
    }
  }

  const downloadCanvas = (
    ref: React.RefObject<HTMLCanvasElement | null>,
    suffix: string
  ) => {
    const canvas = ref.current
    if (!canvas) return
    const base =
      selectedCompany?.slug || (artist ? slugify(artist) : 'thumbnail')
    const songPart = song.trim() ? `-${slugify(song)}` : ''
    const filename = `${base}${songPart}-${suffix}.jpg`
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      },
      'image/jpeg',
      0.92
    )
  }

  const hasVideo = Boolean(videoUrl)
  const igSlack = videoDims
    ? coverSlack(videoDims.w, videoDims.h, IG_W, IG_H)
    : { slackX: 0, slackY: 0 }
  const igCanPan = igSlack.slackX > 1 || igSlack.slackY > 1

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      {/* Hidden frame source. */}
      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          muted
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          onLoadedMetadata={handleLoadedMetadata}
          onSeeked={handleSeeked}
          onLoadedData={() => {
            setVideoReady(true)
            draw()
          }}
          className="pointer-events-none absolute h-px w-px opacity-0"
          aria-hidden
        />
      )}

      {/* ---------------- Controls ---------------- */}
      <div className="space-y-6">
        <Card padding="md" className="space-y-4">
          <h2 className="text-lg font-semibold text-white">1. Source video</h2>
          <FileDropzone
            accept="video/*"
            file={videoFile}
            onFileSelect={handleVideoSelect}
            label="Video file"
            placeholder="Drop a video or click to choose"
            helperText="Stays on your machine — nothing is uploaded."
          />
        </Card>

        <Card padding="md" className="space-y-4">
          <h2 className="text-lg font-semibold text-white">2. Branding</h2>
          <AdminFormField label="Band / company">
            <AdminSelect
              value={companySlug}
              onChange={(e) => handleCompanyChange(e.target.value)}
            >
              <option value="">— Select a company —</option>
              {withLogos.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </AdminSelect>
          </AdminFormField>
          {logoError && <p className="text-sm text-error">{logoError}</p>}

          <AdminFormField label="Artist name">
            <AdminInput
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="e.g. The Null Pointers"
            />
          </AdminFormField>

          <AdminFormField label="Song title">
            <AdminInput
              value={song}
              onChange={(e) => setSong(e.target.value)}
              placeholder="e.g. Stairway to Production"
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
        </Card>
      </div>

      {/* ---------------- Previews ---------------- */}
      <div className="space-y-6">
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              YouTube · {YT_W}×{YT_H}
            </h2>
            <Button
              size="sm"
              variant="accent"
              disabled={!hasVideo}
              onClick={() => downloadCanvas(ytCanvasRef, 'youtube')}
            >
              <DownloadIcon className="mr-1.5 h-4 w-4" />
              Download
            </Button>
          </div>

          <canvas
            ref={ytCanvasRef}
            width={YT_W}
            height={YT_H}
            className="w-full rounded-lg border border-white/10 bg-black"
          />

          {/* Scrubber + keyframe filmstrip live directly under the preview. */}
          {!hasVideo ? (
            <p className="text-sm text-gray-400">
              Add a video to scrub through frames.
            </p>
          ) : (
            <div className="space-y-3">
              {keyframes.length > 0 && (
                <div className="flex gap-1 overflow-x-auto">
                  {keyframes.map((kf) => {
                    const active =
                      Math.abs(kf.time - scrubTime) < (duration || 1) / 20
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={kf.time}
                        src={kf.url}
                        alt={`Frame at ${formatTime(kf.time)}`}
                        onClick={() => requestSeek(kf.time)}
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
                max={duration || 0}
                step={0.01}
                value={scrubTime}
                onChange={(e) => requestSeek(parseFloat(e.target.value))}
                disabled={!duration}
                className="w-full accent-accent"
              />

              <div className="flex items-center justify-between text-sm text-gray-300">
                <span className="tabular-nums">{formatTime(scrubTime)}</span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline-solid"
                    onClick={() => requestSeek(scrubTime - 1)}
                  >
                    −1s
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-solid"
                    onClick={() => requestSeek(scrubTime - FRAME)}
                  >
                    −1f
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-solid"
                    onClick={() => requestSeek(scrubTime + FRAME)}
                  >
                    +1f
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-solid"
                    onClick={() => requestSeek(scrubTime + 1)}
                  >
                    +1s
                  </Button>
                </div>
                <span className="tabular-nums text-gray-500">
                  {formatTime(duration)}
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Instagram Reel/Story · {IG_W}×{IG_H}
            </h2>
            <Button
              size="sm"
              variant="accent"
              disabled={!hasVideo}
              onClick={() => downloadCanvas(igCanvasRef, 'instagram')}
            >
              <DownloadIcon className="mr-1.5 h-4 w-4" />
              Download
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Clean frame, no overlays.{' '}
            {igCanPan
              ? 'Drag the preview to reposition the crop.'
              : 'Caption carries the text.'}
          </p>
          <canvas
            ref={igCanvasRef}
            width={IG_W}
            height={IG_H}
            onPointerDown={handleIgPointerDown}
            onPointerMove={handleIgPointerMove}
            onPointerUp={handleIgPointerUp}
            onPointerCancel={handleIgPointerUp}
            className={`mx-auto w-full max-w-[260px] touch-none rounded-lg border border-white/10 bg-black ${
              igCanPan ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
          />
        </Card>
      </div>
    </div>
  )
}
