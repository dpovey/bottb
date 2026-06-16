'use client'

import { useEffect, useState } from 'react'
import { HeartIcon } from '@/components/icons'
import { Photo } from '@/lib/db-types'
import { trackPhotoHeart } from '@/lib/analytics'
import {
  isPhotoHeartedLocally,
  togglePhotoHeartRequest,
} from '@/lib/photo-hearts-client'

interface HeartButtonProps {
  photo: Photo
  /** Visual size — `sm` for grid overlays, `md` for slideshow/detail toolbars. */
  size?: 'sm' | 'md'
  /** Hide the numeric count (e.g. very small overlays). */
  showCount?: boolean
  className?: string
}

const SIZES = {
  sm: { icon: 14, text: 'text-xs', gap: 'gap-1', pad: 'px-1.5 py-1' },
  md: { icon: 20, text: 'text-sm', gap: 'gap-1.5', pad: 'px-2.5 py-1.5' },
} as const

/**
 * Public "heart" (like) button for a photo. Anonymous and toggleable — one
 * heart per visitor, deduped server-side. Shows the running public count.
 *
 * Optimistically updates on tap, then reconciles with the server's
 * authoritative `{ hearted, heart_count }` response.
 */
export function HeartButton({
  photo,
  size = 'md',
  showCount = true,
  className = '',
}: HeartButtonProps) {
  const [hearted, setHearted] = useState(false)
  const [count, setCount] = useState(photo.heart_count ?? 0)
  const [pending, setPending] = useState(false)
  const dims = SIZES[size]

  // Read this browser's remembered state after mount to avoid hydration
  // mismatch (localStorage is client-only).
  useEffect(() => {
    setHearted(isPhotoHeartedLocally(photo.id))
  }, [photo.id])

  const handleClick = async (e: React.MouseEvent) => {
    // Heart buttons often sit on clickable cards/slides — don't bubble.
    e.stopPropagation()
    e.preventDefault()
    if (pending) return

    // Optimistic update.
    const nextHearted = !hearted
    setHearted(nextHearted)
    setCount((c) => Math.max(0, c + (nextHearted ? 1 : -1)))
    setPending(true)

    try {
      const result = await togglePhotoHeartRequest(photo.id)
      setHearted(result.hearted)
      setCount(result.heart_count)
      trackPhotoHeart({
        photo_id: photo.id,
        hearted: result.hearted,
        event_id: photo.event_id,
        band_id: photo.band_id,
        photographer: photo.photographer,
        event_name: photo.event_name,
        band_name: photo.band_name,
      })
    } catch {
      // Revert optimistic update on failure.
      setHearted(!nextHearted)
      setCount((c) => Math.max(0, c + (nextHearted ? -1 : 1)))
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={hearted}
      aria-label={hearted ? 'Remove heart from photo' : 'Heart photo'}
      title={hearted ? 'Remove heart' : 'Heart this photo'}
      className={`flex items-center ${dims.gap} ${dims.pad} rounded-lg bg-black/70 backdrop-blur-xs transition-all hover:bg-black/80 disabled:opacity-60 ${
        hearted ? 'text-accent' : 'text-white/90 hover:text-white'
      } ${className}`}
      disabled={pending}
    >
      <HeartIcon size={dims.icon} fill={hearted ? 'currentColor' : 'none'} />
      {showCount && (
        <span className={`${dims.text} font-medium tabular-nums`}>{count}</span>
      )}
    </button>
  )
}
