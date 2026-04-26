import Link from 'next/link'
import { ReactNode } from 'react'

interface SplitBannerProps {
  leftSrc: string
  rightSrc: string
  /** Natural width of the left image piece in pixels */
  leftWidth: number
  /** Natural width of the right image piece in pixels */
  rightWidth: number
  /** Shared height of the image pieces in pixels */
  height: number
  alt: string
  href?: string
  /** Max rendered height of the banner (px). Default: natural height. */
  maxHeight?: number
  /**
   * Image opacity (0..1). Default 1. Lower to dim the banner so overlaid
   * content reads clearly.
   */
  imageOpacity?: number
  /** Content rendered centered on top of the banner. */
  children?: ReactNode
}

/**
 * Responsive banner split into two images joined by a black stretchable
 * middle. At narrow viewports the pieces meet (no gap) and look like the
 * original combined image. At viewports wider than the natural image width
 * the middle stretches to fill.
 *
 * Accepts `children` which are rendered centered on top of the banner —
 * useful for hero text/CTAs over a dimmed banner background.
 */
export function SplitBanner({
  leftSrc,
  rightSrc,
  leftWidth,
  rightWidth,
  height,
  alt,
  href,
  maxHeight,
  imageOpacity = 1,
  children,
}: SplitBannerProps) {
  const totalWidth = leftWidth + rightWidth
  const cappedHeight = maxHeight ?? height

  const imagePair = (
    <div
      className="flex items-stretch w-full h-full"
      style={{ opacity: imageOpacity }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={leftSrc}
        alt={alt}
        className="h-full w-auto flex-none object-contain"
      />
      <div className="flex-1 bg-black" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={rightSrc}
        alt=""
        aria-hidden="true"
        className="h-full w-auto flex-none object-contain"
      />
    </div>
  )

  const container = (
    <div
      className="relative w-full bg-black overflow-hidden"
      style={{
        aspectRatio: `${totalWidth} / ${height}`,
        maxHeight: `${cappedHeight}px`,
      }}
    >
      {href ? (
        <Link href={href} aria-label={alt} className="absolute inset-0 z-0">
          {imagePair}
        </Link>
      ) : (
        <div className="absolute inset-0 z-0">{imagePair}</div>
      )}
      {children && (
        <div className="relative z-10 h-full w-full flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  )

  return container
}
