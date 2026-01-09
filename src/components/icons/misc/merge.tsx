import { forwardRef } from 'react'
import type { IconProps } from '../types'

/**
 * Merge icon - two arrows converging into one
 */
export const MergeIcon = forwardRef<SVGSVGElement, IconProps>(
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
      {/* Two paths converging */}
      <path d="M6 3v6" />
      <path d="M18 3v6" />
      <path d="M6 9c0 3 3 6 6 6" />
      <path d="M18 9c0 3-3 6-6 6" />
      <path d="M12 15v6" />
      <path d="M9 18l3 3 3-3" />
    </svg>
  )
)

MergeIcon.displayName = 'MergeIcon'
