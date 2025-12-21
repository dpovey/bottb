import { forwardRef } from 'react'
import type { IconProps } from '../types'

/**
 * Lightning bolt icon for AI, quick actions
 */
export const LightningIcon = forwardRef<SVGSVGElement, IconProps>(
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
      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
)

LightningIcon.displayName = 'LightningIcon'
