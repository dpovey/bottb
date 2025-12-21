import { forwardRef } from 'react'
import type { IconProps } from '../types'

/**
 * Simple play triangle icon
 */
export const PlayIcon = forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, className, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M5 3l14 9-14 9V3z" />
    </svg>
  )
)

PlayIcon.displayName = 'PlayIcon'
