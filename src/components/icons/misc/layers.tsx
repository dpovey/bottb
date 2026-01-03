import { forwardRef } from 'react'
import type { IconProps } from '../types'

/**
 * Overlapping squares icon indicating grouped/similar photos.
 * Two offset rectangles suggesting a stack of images.
 */
export const LayersIcon = forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, className, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Back rectangle (offset to top-left) */}
      <rect x="3" y="3" width="14" height="14" rx="2" />
      {/* Front rectangle (offset to bottom-right) */}
      <rect x="7" y="7" width="14" height="14" rx="2" />
    </svg>
  )
)

LayersIcon.displayName = 'LayersIcon'
