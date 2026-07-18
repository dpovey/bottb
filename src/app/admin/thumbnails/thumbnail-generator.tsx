'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, FileDropzone } from '@/components/ui'
import { AdminFormField, AdminInput, AdminSelect } from '@/components/ui'
import { DownloadIcon } from '@/components/icons'
import type { SetlistSong } from '@/lib/db'
import type { Band, Event } from '@/lib/db-types'
import { coverSlack, loadImage } from '@/lib/canvas'
import {
  composeInstagram,
  composeOverlay,
  composeYouTube,
  IG_H,
  IG_W,
  OV_H,
  OV_W,
  YT_H,
  YT_W,
  type InstagramMode,
  type LogoCorner,
} from './compose'
import { loadJostFont } from './jost-font'
import { useKeyframes } from './use-keyframes'

const BOTTB_LOGO_SRC = '/images/logos/bottb-square-black.png'
const FRAME = 1 / 30 // assume ~30fps for single-frame stepping

interface ThumbnailGeneratorProps {
  events: Event[]
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** The band's primary company logo (multi-company bands, or the legacy single company). */
function bandLogoUrl(band: Band): string | undefined {
  return (
    band.companies?.find((c) => c.logo_url)?.logo_url ?? band.company_logo_url
  )
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

export function ThumbnailGenerator({ events }: ThumbnailGeneratorProps) {
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

  const [eventId, setEventId] = useState('')
  const [bands, setBands] = useState<Band[]>([])
  const [bandId, setBandId] = useState('')
  const [songsByBand, setSongsByBand] = useState<Record<string, SetlistSong[]>>(
    {}
  )
  const [artist, setArtist] = useState('')
  const [song, setSong] = useState('')
  const [bottbCorner, setBottbCorner] = useState<LogoCorner>('top-right')

  // Instagram crop focal point (0..1 on each axis; 0.5 = centred).
  const [igFocusX, setIgFocusX] = useState(0.5)
  const [igFocusY, setIgFocusY] = useState(0.5)
  const [igMode, setIgMode] = useState<InstagramMode>('fill')
  const [showSafeZones, setShowSafeZones] = useState(true)

  const [bottbLogo, setBottbLogo] = useState<HTMLImageElement | null>(null)
  const [companyLogo, setCompanyLogo] = useState<HTMLImageElement | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [fontReady, setFontReady] = useState(false)
  const [pngSizeWarning, setPngSizeWarning] = useState<string | null>(null)

  // Seek coalescing — never queue more than one pending seek so fast dragging
  // doesn't back up a long chain of decodes.
  const seekingRef = useRef(false)
  const pendingSeekRef = useRef<number | null>(null)

  const keyframes = useKeyframes(videoUrl)

  // Load the Bottb square logo + website font once.
  useEffect(() => {
    loadImage(BOTTB_LOGO_SRC)
      .then(setBottbLogo)
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

  // Load every band's setlist for the selected event (admin endpoint, so it
  // includes songs regardless of locked/finalized status) — used to power
  // the song combobox.
  useEffect(() => {
    if (!eventId) {
      Promise.resolve().then(() => setSongsByBand({}))
      return
    }
    let cancelled = false
    fetch(`/api/events/${eventId}/setlists`)
      .then((res) => (res.ok ? res.json() : { setlists: [] }))
      .then(
        (data: { setlists?: { band_id: string; songs: SetlistSong[] }[] }) => {
          if (cancelled) return
          const map: Record<string, SetlistSong[]> = {}
          for (const setlist of data.setlists ?? []) {
            map[setlist.band_id] = setlist.songs
          }
          setSongsByBand(map)
        }
      )
      .catch(() => {
        if (!cancelled) setSongsByBand({})
      })
    return () => {
      cancelled = true
    }
  }, [eventId])

  const selectedBand = bands.find((b) => b.id === bandId) ?? null
  const bandSongs = bandId ? (songsByBand[bandId] ?? []) : []

  // Load the selected band's logo through the same-origin proxy. All state
  // updates happen inside the async callbacks to avoid cascading renders.
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
      // A vertical source already fills the 9:16 box, so it never needs the
      // letterbox ('fit') treatment — only landscape sources do.
      const portrait = sh > sw
      composeInstagram(ig, source, sw, sh, {
        focusX: igFocusX,
        focusY: igFocusY,
        mode: portrait ? 'fill' : igMode,
      })
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
    igMode,
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
    setIgMode('fill')
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

  const handleEventChange = (id: string) => {
    setEventId(id)
    setBandId('')
  }

  const handleBandChange = (id: string) => {
    setBandId(id)
    const band = bands.find((b) => b.id === id)
    if (band) setArtist(band.name)
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

  const triggerDownload = (blob: Blob | null, filename: string) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const buildName = (suffix: string, ext: string) => {
    const base = selectedBand
      ? slugify(selectedBand.name)
      : artist
        ? slugify(artist)
        : 'thumbnail'
    const songPart = song.trim() ? `-${slugify(song)}` : ''
    return `${base}${songPart}-${suffix}.${ext}`
  }

  const YOUTUBE_MAX_BYTES = 2 * 1024 * 1024

  const downloadCanvas = (
    ref: React.RefObject<HTMLCanvasElement | null>,
    suffix: string
  ) => {
    const canvas = ref.current
    if (!canvas) return
    canvas.toBlob(
      (blob) => triggerDownload(blob, buildName(suffix, 'jpg')),
      'image/jpeg',
      0.92
    )
  }

  // YouTube re-compresses whatever we upload, so a lossless source avoids
  // stacking our own JPEG pass on top of theirs. PNG can blow past YouTube's
  // 2MB thumbnail cap on a busy/noisy frame, so we warn rather than silently
  // handing over a file that'll get rejected.
  const downloadYouTubePng = () => {
    const canvas = ytCanvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      if (blob.size > YOUTUBE_MAX_BYTES) {
        setPngSizeWarning(
          `PNG export is ${(blob.size / (1024 * 1024)).toFixed(1)}MB, over YouTube's 2MB thumbnail limit. Use the JPEG export instead.`
        )
      } else {
        setPngSizeWarning(null)
      }
      triggerDownload(blob, buildName('youtube', 'png'))
    }, 'image/png')
  }

  // Transparent 4K PNG of just the logos + text, for compositing over the
  // start of a video. Rendered off-screen so we never mount a 4K canvas.
  const downloadOverlay = () => {
    const canvas = document.createElement('canvas')
    canvas.width = OV_W
    canvas.height = OV_H
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    composeOverlay(ctx, { artist, song, bottbLogo, companyLogo, bottbCorner })
    canvas.toBlob(
      (blob) => triggerDownload(blob, buildName('overlay-4k', 'png')),
      'image/png'
    )
  }

  const hasVideo = Boolean(videoUrl)
  const isPortrait = videoDims ? videoDims.h > videoDims.w : false
  const effectiveIgMode: InstagramMode = isPortrait ? 'fill' : igMode
  const igSlack = videoDims
    ? coverSlack(videoDims.w, videoDims.h, IG_W, IG_H)
    : { slackX: 0, slackY: 0 }
  // Repositioning only makes sense when we're actually cropping (fill mode).
  const igCanPan =
    effectiveIgMode === 'fill' && (igSlack.slackX > 1 || igSlack.slackY > 1)

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

          <AdminFormField label="Artist name">
            <AdminInput
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="e.g. The Null Pointers"
            />
          </AdminFormField>

          <AdminFormField
            label="Song title"
            helperText={
              bandSongs.length > 0
                ? `Pick from this band's ${bandSongs.length}-song setlist, or type any title.`
                : 'Type any title — no setlist songs loaded for this band yet.'
            }
          >
            <AdminInput
              value={song}
              onChange={(e) => setSong(e.target.value)}
              placeholder="e.g. Stairway to Production"
              list="setlist-songs"
            />
            <datalist id="setlist-songs">
              {bandSongs.map((s) => (
                <option key={s.id} value={s.title} />
              ))}
            </datalist>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-white">
              YouTube{!isPortrait && ' / LinkedIn'} · {YT_W}×{YT_H}
            </h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="accent"
                disabled={!hasVideo}
                onClick={() => downloadCanvas(ytCanvasRef, 'youtube')}
              >
                <DownloadIcon className="mr-1.5 h-4 w-4" />
                YouTube (JPEG)
              </Button>
              <Button
                size="sm"
                variant="outline-solid"
                disabled={!hasVideo}
                title="Lossless PNG — avoids double JPEG compression, but may exceed YouTube's 2MB limit on busy frames"
                onClick={downloadYouTubePng}
              >
                <DownloadIcon className="mr-1.5 h-4 w-4" />
                YouTube (PNG)
              </Button>
              {!isPortrait && (
                <Button
                  size="sm"
                  variant="outline-solid"
                  disabled={!hasVideo}
                  onClick={() => downloadCanvas(ytCanvasRef, 'linkedin')}
                >
                  <DownloadIcon className="mr-1.5 h-4 w-4" />
                  LinkedIn
                </Button>
              )}
              <Button
                size="sm"
                variant="outline-solid"
                disabled={!fontReady}
                title="Transparent 4K PNG of the logos + text, to composite over the start of the video"
                onClick={downloadOverlay}
              >
                <DownloadIcon className="mr-1.5 h-4 w-4" />
                Overlay 4K
              </Button>
            </div>
          </div>

          {pngSizeWarning && (
            <p className="text-xs text-amber-400/80">{pngSizeWarning}</p>
          )}

          <canvas
            ref={ytCanvasRef}
            width={YT_W}
            height={YT_H}
            className="w-full rounded-lg border border-white/10 bg-black"
          />
          {isPortrait && (
            <p className="text-xs text-amber-400/80">
              Vertical source — this 16:9 frame is cropped for YouTube. For
              LinkedIn, use the vertical export below (LinkedIn matches the
              video&apos;s shape).
            </p>
          )}

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-white">
              Reel / Story{isPortrait && ' / LinkedIn'} · {IG_W}×{IG_H}
            </h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="accent"
                disabled={!hasVideo}
                onClick={() => downloadCanvas(igCanvasRef, 'instagram')}
              >
                <DownloadIcon className="mr-1.5 h-4 w-4" />
                Instagram
              </Button>
              {isPortrait && (
                <Button
                  size="sm"
                  variant="outline-solid"
                  disabled={!hasVideo}
                  onClick={() => downloadCanvas(igCanvasRef, 'linkedin')}
                >
                  <DownloadIcon className="mr-1.5 h-4 w-4" />
                  LinkedIn
                </Button>
              )}
            </div>
          </div>

          {/* Crop mode (landscape source only) + safe-zone toggle. */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {hasVideo && !isPortrait && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={igMode === 'fill' ? 'accent' : 'outline-solid'}
                  onClick={() => setIgMode('fill')}
                >
                  Fill (crop)
                </Button>
                <Button
                  size="sm"
                  variant={igMode === 'fit' ? 'accent' : 'outline-solid'}
                  onClick={() => setIgMode('fit')}
                >
                  Fit (letterbox)
                </Button>
              </div>
            )}
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                checked={showSafeZones}
                onChange={(e) => setShowSafeZones(e.target.checked)}
                className="accent-accent"
              />
              Safe zones
            </label>
          </div>

          <p className="text-xs text-gray-500">
            {isPortrait
              ? 'Vertical source — fills the frame.'
              : effectiveIgMode === 'fit'
                ? 'Whole frame over a blurred fill.'
                : igCanPan
                  ? 'Cropped to vertical — drag the preview to reposition.'
                  : 'Cropped to vertical.'}
          </p>

          <div className="relative mx-auto w-full max-w-[260px]">
            <canvas
              ref={igCanvasRef}
              width={IG_W}
              height={IG_H}
              onPointerDown={handleIgPointerDown}
              onPointerMove={handleIgPointerMove}
              onPointerUp={handleIgPointerUp}
              onPointerCancel={handleIgPointerUp}
              className={`block w-full touch-none rounded-lg border border-white/10 bg-black ${
                igCanPan ? 'cursor-grab active:cursor-grabbing' : ''
              }`}
            />
            {showSafeZones && hasVideo && (
              <div className="pointer-events-none absolute inset-0 text-[9px] font-medium uppercase tracking-wide">
                {/* Profile-grid crop (~4:5, centred). */}
                <div
                  className="absolute inset-x-0 border-y border-dashed border-accent/70"
                  style={{ top: '14.8%', bottom: '14.8%' }}
                >
                  <span className="absolute left-1 top-0.5 text-accent/80">
                    Grid 4:5
                  </span>
                </div>
                {/* Top profile/handle chrome. */}
                <div
                  className="absolute inset-x-0 top-0 bg-black/35"
                  style={{ height: '13%' }}
                />
                {/* Bottom caption / audio chrome. */}
                <div
                  className="absolute inset-x-0 bottom-0 bg-black/35"
                  style={{ height: '21%' }}
                />
                {/* Right-hand action buttons. */}
                <div
                  className="absolute right-0 bg-black/30"
                  style={{ top: '45%', bottom: '21%', width: '15%' }}
                />
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
