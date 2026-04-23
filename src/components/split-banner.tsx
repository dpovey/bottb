import Link from 'next/link'

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
}

/**
 * Responsive banner split into two images joined by a black stretchable
 * middle. At narrow viewports the pieces meet (no gap) and look like the
 * original combined image. At viewports wider than the natural image width
 * the middle stretches to fill.
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
}: SplitBannerProps) {
  const totalWidth = leftWidth + rightWidth
  const cappedHeight = maxHeight ?? height

  const content = (
    <div
      className="flex items-stretch w-full bg-black"
      style={{
        aspectRatio: `${totalWidth} / ${height}`,
        maxHeight: `${cappedHeight}px`,
      }}
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

  if (href) {
    return (
      <Link href={href} className="block" aria-label={alt}>
        {content}
      </Link>
    )
  }
  return content
}
