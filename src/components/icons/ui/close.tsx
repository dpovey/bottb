import { forwardRef } from 'react'
import type { IconProps } from '../types'

/**
 * Close/X icon for dismissing modals, menus, etc.
 */
export const CloseIcon = forwardRef<SVGSVGElement, IconProps>(
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
      <path d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
)

CloseIcon.displayName = 'CloseIcon'
