'use client'

import { useState, useCallback } from 'react'
import { Photo } from '@/lib/db-types'
import { trackPhotoShare } from '@/lib/analytics'
import { CheckIcon, LinkIcon, ShareIcon } from '@/components/icons'

interface PhotoShareButtonProps {
  /** The photo to share */
  photo: Photo
  /** The URL to share (defaults to current page URL) */
  shareUrl?: string
  /** Visual variant - link shows copy link icon, share shows native share icon */
  variant?: 'link' | 'share'
  /** Size of the button */
  size?: 'sm' | 'md'
  /** Custom class name */
  className?: string
}

/**
 * Public share button for photos.
 * Supports native Web Share API with fallback to copy-to-clipboard.
 */
export function PhotoShareButton({
  photo,
  shareUrl,
  variant = 'link',
  size = 'md',
  className = '',
}: PhotoShareButtonProps) {
  const [copied, setCopied] = useState(false)

  // Build share text
  const getShareText = useCallback(() => {
    let text = 'Check out this photo from Battle of the Tech Bands!'
    if (photo.band_name && photo.event_name) {
      text = `${photo.band_name} at ${photo.event_name} - Battle of the Tech Bands`
    } else if (photo.band_name) {
      text = `${photo.band_name} at Battle of the Tech Bands`
    } else if (photo.event_name) {
      text = `Photo from ${photo.event_name} - Battle of the Tech Bands`
    }
    return text
  }, [photo])

  // Get the URL to share
  const getShareUrl = useCallback(() => {
    if (shareUrl) return shareUrl
    // Use current URL if in browser
    if (typeof window !== 'undefined') {
      return window.location.href
    }
    return ''
  }, [shareUrl])

  // Copy link to clipboard
  const handleCopyLink = useCallback(async () => {
    try {
      const url = getShareUrl()
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)

      // Track share
      trackPhotoShare({
        photo_id: photo.id,
        share_method: 'copy_link',
        event_id: photo.event_id || null,
        band_id: photo.band_id || null,
        event_name: photo.event_name || null,
        band_name: photo.band_name || null,
      })
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }, [photo, getShareUrl])

  // Use native share API if available
  const handleNativeShare = useCallback(async () => {
    const url = getShareUrl()
    const text = getShareText()

    if (navigator.share) {
      try {
        await navigator.share({
          title: text,
          url: url,
        })

        // Track share (use copy_link as the closest method type)
        trackPhotoShare({
          photo_id: photo.id,
          share_method: 'copy_link',
          event_id: photo.event_id || null,
          band_id: photo.band_id || null,
          event_name: photo.event_name || null,
          band_name: photo.band_name || null,
        })
      } catch (error) {
        // User cancelled or share failed - fall back to copy
        if ((error as Error).name !== 'AbortError') {
          handleCopyLink()
        }
      }
    } else {
      // Fallback to copy link
      handleCopyLink()
    }
  }, [photo, getShareUrl, getShareText, handleCopyLink])

  const handleClick = variant === 'share' ? handleNativeShare : handleCopyLink

  const sizeClasses = size === 'sm' ? 'p-1.5' : 'p-2'
  const iconSize = size === 'sm' ? 18 : 20

  return (
    <button
      onClick={handleClick}
      className={`${sizeClasses} rounded-lg hover:bg-white/5 text-text-muted hover:text-white transition-colors relative ${className}`}
      aria-label={
        variant === 'share'
          ? 'Share photo'
          : copied
            ? 'Link copied!'
            : 'Copy link to photo'
      }
      title={variant === 'share' ? 'Share' : copied ? 'Copied!' : 'Copy link'}
    >
      {copied ? (
        <CheckIcon size={iconSize} className="text-success" />
      ) : variant === 'share' ? (
        <ShareIcon size={iconSize} />
      ) : (
        <LinkIcon size={iconSize} />
      )}
    </button>
  )
}
