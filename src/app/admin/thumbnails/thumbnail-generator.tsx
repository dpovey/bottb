'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, FileDropzone } from '@/components/ui'
import { AdminFormField, AdminInput, AdminSelect } from '@/components/ui'
import { DownloadIcon } from '@/components/icons'
import type { CompanyWithStats } from '@/lib/db-types'
import {
  composeInstagram,
  composeYouTube,
  IG_H,
  IG_W,
  YT_H,
  YT_W,
  type LogoCorner,
} from './compose'
import { loadJostFont } from './jost-font'

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

export function ThumbnailGenerator({ companies }: ThumbnailGeneratorProps) {
  // Only companies with a usable logo can drive the top-left brand mark.
  const withLogos = companies.filter((c) => c.logo_url)

  const videoRef = useRef<HTMLVideoElement>(null)
  const ytCanvasRef = useRef<HTMLCanvasElement>(null)
  const igCanvasRef = useRef<HTMLCanvasElement>(null)

  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoReady, setVideoReady] = useState(false)

  const [companySlug, setCompanySlug] = useState('')
  const [artist, setArtist] = useState('')
  const [song, setSong] = useState('')
  const [bottbCorner, setBottbCorner] = useState<LogoCorner>('top-right')

  const [bottbLogo, setBottbLogo] = useState<HTMLImageElement | null>(null)
  const [companyLogo, setCompanyLogo] = useState<HTMLImageElement | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [fontReady, setFontReady] = useState(false)

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
  // updates happen inside the async callbacks (never synchronously in the
  // effect body) to avoid cascading renders.
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
      composeInstagram(ig, source, sw, sh)
    }
  }, [videoReady, artist, song, bottbLogo, companyLogo, bottbCorner])

  useEffect(() => {
    draw()
  }, [draw, currentTime, fontReady])

  const handleVideoSelect = (file: File | null) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoReady(false)
    setDuration(0)
    setCurrentTime(0)
    setVideoFile(file)
    setVideoUrl(file ? URL.createObjectURL(file) : null)
  }

  const handleLoadedMetadata = () => {
    const video = videoRef.current
    if (!video) return
    setDuration(video.duration || 0)
  }

  const handleSeeked = () => {
    const video = videoRef.current
    if (video) setCurrentTime(video.currentTime)
  }

  const seekTo = (time: number) => {
    const video = videoRef.current
    if (!video || !duration) return
    const clamped = Math.max(0, Math.min(duration, time))
    video.currentTime = clamped
    setCurrentTime(clamped)
  }

  const handleCompanyChange = (slug: string) => {
    setCompanySlug(slug)
    const company = withLogos.find((c) => c.slug === slug)
    if (company) setArtist(company.name)
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
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

        <Card padding="md" className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            3. Choose a frame
          </h2>
          {!hasVideo ? (
            <p className="text-sm text-gray-400">
              Add a video to scrub through frames.
            </p>
          ) : (
            <>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.01}
                value={currentTime}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                disabled={!duration}
                className="w-full accent-accent"
              />
              <div className="flex items-center justify-between text-sm text-gray-300">
                <span className="tabular-nums">{formatTime(currentTime)}</span>
                <span className="tabular-nums text-gray-500">
                  {formatTime(duration)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline-solid"
                  onClick={() => seekTo(currentTime - 1)}
                >
                  −1s
                </Button>
                <Button
                  size="sm"
                  variant="outline-solid"
                  onClick={() => seekTo(currentTime - FRAME)}
                >
                  −1 frame
                </Button>
                <Button
                  size="sm"
                  variant="outline-solid"
                  onClick={() => seekTo(currentTime + FRAME)}
                >
                  +1 frame
                </Button>
                <Button
                  size="sm"
                  variant="outline-solid"
                  onClick={() => seekTo(currentTime + 1)}
                >
                  +1s
                </Button>
              </div>
            </>
          )}
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
            Clean frame, no overlays — the caption carries the text.
          </p>
          <canvas
            ref={igCanvasRef}
            width={IG_W}
            height={IG_H}
            className="mx-auto w-full max-w-[260px] rounded-lg border border-white/10 bg-black"
          />
        </Card>
      </div>
    </div>
  )
}
