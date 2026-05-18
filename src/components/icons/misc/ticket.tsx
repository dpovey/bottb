import { forwardRef } from 'react'
import type { IconProps } from '../types'

/**
 * Ticket icon — symmetric rounded stub with semi-circle notches centred on
 * the perforation line (top and bottom) and three dashes along it.
 */
export const TicketIcon = forwardRef<SVGSVGElement, IconProps>(
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
      <path d="M4 7h7a1 1 0 0 0 2 0h7a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-7a1 1 0 0 1-2 0H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
      <path d="M12 9.5v1M12 12v1M12 14.5v1" />
    </svg>
  )
)

TicketIcon.displayName = 'TicketIcon'
