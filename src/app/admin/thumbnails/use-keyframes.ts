import { useEffect, useState } from 'react'

export interface Keyframe {
  time: number
  url: string
}

const THUMB_W = 160
const THUMB_H = 90

/**
 * Extract a strip of evenly-spaced preview frames from a video URL using a
 * dedicated offscreen <video> element, so it never disturbs the main scrubbing
 * video's position. Frames stream in as they're decoded.
 */
export function useKeyframes(videoUrl: string | null, count = 10): Keyframe[] {
  const [frames, setFrames] = useState<Keyframe[]>([])

  useEffect(() => {
    let cancelled = false

    if (!videoUrl) {
      // Clear asynchronously to avoid a synchronous setState in the effect body.
      Promise.resolve().then(() => {
        if (!cancelled) setFrames([])
      })
      return () => {
        cancelled = true
      }
    }

    const video = document.createElement('video')
    video.muted = true
    video.crossOrigin = 'anonymous'
    video.preload = 'auto'
    video.src = videoUrl

    const canvas = document.createElement('canvas')
    canvas.width = THUMB_W
    canvas.height = THUMB_H
    const ctx = canvas.getContext('2d')

    const collected: Keyframe[] = []
    let times: number[] = []
    let i = 0

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleMeta)
      video.removeEventListener('seeked', handleSeeked)
      video.removeAttribute('src')
      video.load()
    }

    const seekNext = () => {
      if (cancelled) return
      if (i >= times.length) {
        cleanup()
        return
      }
      video.currentTime = times[i]
    }

    const handleMeta = () => {
      const duration = video.duration || 0
      if (!duration || !ctx) {
        cleanup()
        return
      }
      times = Array.from(
        { length: count },
        (_, k) => (duration * (k + 0.5)) / count
      )
      seekNext()
    }

    const handleSeeked = () => {
      if (cancelled || !ctx) return
      const sw = video.videoWidth
      const sh = video.videoHeight
      if (sw && sh) {
        const scale = Math.max(THUMB_W / sw, THUMB_H / sh)
        const w = sw * scale
        const h = sh * scale
        ctx.drawImage(video, (THUMB_W - w) / 2, (THUMB_H - h) / 2, w, h)
        collected.push({
          time: times[i],
          url: canvas.toDataURL('image/jpeg', 0.6),
        })
        setFrames([...collected])
      }
      i += 1
      seekNext()
    }

    video.addEventListener('loadedmetadata', handleMeta)
    video.addEventListener('seeked', handleSeeked)

    return () => {
      cancelled = true
      cleanup()
    }
  }, [videoUrl, count])

  return frames
}
