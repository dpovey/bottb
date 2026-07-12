'use client'

import { useEffect, useRef, useState } from 'react'

/** Assumed frame rate for single-frame stepping (`requestSeek(t +/- FRAME)`). */
export const SCRUB_FRAME = 1 / 30

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export interface VideoScrubber {
  videoUrl: string | null
  videoFile: File | null
  duration: number
  /** Tracks the slider thumb immediately, even mid-seek. */
  scrubTime: number
  /** The actually-decoded frame time — what should drive a redraw. */
  currentTime: number
  videoReady: boolean
  videoDims: { w: number; h: number } | null
  /**
   * Bumps on every decoded frame, including mid-drag ones the coalescer
   * swallows before they reach `currentTime`. Add it to a redraw effect's
   * deps for smooth live feedback while scrubbing.
   */
  frameTick: number
  /** Swap the source video (or clear it with `null`). */
  selectVideo: (file: File | null) => void
  /** Seek to `time`, coalescing fast drags into a single pending decode. */
  requestSeek: (time: number) => void
  onLoadedMetadata: () => void
  onSeeked: () => void
  onLoadedData: () => void
}

/**
 * Drives a hidden `<video>` element used purely as a frame source for canvas
 * previews: file selection, metadata/duration, and coalesced seeking (never
 * more than one decode in flight, so fast scrubbing doesn't queue a long
 * chain of seeks). Callers own the actual canvas drawing — call it from a
 * `useEffect` keyed on `frameTick` (and whatever else affects the drawing).
 *
 * Takes the `<video>` ref rather than creating it internally so the returned
 * state object never carries a ref, keeping it safe to read freely at render
 * time.
 */
export function useVideoScrubber(
  videoRef: React.RefObject<HTMLVideoElement | null>
): VideoScrubber {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [duration, setDuration] = useState(0)
  const [scrubTime, setScrubTime] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoReady, setVideoReady] = useState(false)
  const [videoDims, setVideoDims] = useState<{ w: number; h: number } | null>(
    null
  )
  const [frameTick, setFrameTick] = useState(0)

  // Seek coalescing — never queue more than one pending seek.
  const seekingRef = useRef(false)
  const pendingSeekRef = useRef<number | null>(null)

  // Clean up the object URL when the video changes / unmounts.
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
  }, [videoUrl])

  const selectVideo = (file: File | null) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    seekingRef.current = false
    pendingSeekRef.current = null
    setVideoReady(false)
    setVideoDims(null)
    setDuration(0)
    setScrubTime(0)
    setCurrentTime(0)
    setVideoFile(file)
    setVideoUrl(file ? URL.createObjectURL(file) : null)
  }

  const onLoadedMetadata = () => {
    const video = videoRef.current
    if (!video) return
    setDuration(video.duration || 0)
    if (video.videoWidth && video.videoHeight) {
      setVideoDims({ w: video.videoWidth, h: video.videoHeight })
    }
  }

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

  const onSeeked = () => {
    const video = videoRef.current
    if (!video) return
    setFrameTick((t) => t + 1)
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

  const onLoadedData = () => {
    setVideoReady(true)
    setFrameTick((t) => t + 1)
  }

  return {
    videoUrl,
    videoFile,
    duration,
    scrubTime,
    currentTime,
    videoReady,
    videoDims,
    frameTick,
    selectVideo,
    requestSeek,
    onLoadedMetadata,
    onSeeked,
    onLoadedData,
  }
}
