import { forwardRef } from 'react'
import type { IconProps } from '../types'

/**
 * Scenes icon indicating grouped similar scenes/angles.
 * A grid of rectangles suggesting multiple views of the same moment.
 */
export const ScenesIcon = forwardRef<SVGSVGElement, IconProps>(
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
      {/* Top-left rectangle */}
      <rect x="3" y="3" width="7" height="7" rx="1" />
      {/* Top-right rectangle */}
      <rect x="14" y="3" width="7" height="7" rx="1" />
      {/* Bottom-left rectangle */}
      <rect x="3" y="14" width="7" height="7" rx="1" />
      {/* Bottom-right rectangle */}
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
)

ScenesIcon.displayName = 'ScenesIcon'
