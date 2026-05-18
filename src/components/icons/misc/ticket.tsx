import { forwardRef } from 'react'
import type { IconProps } from '../types'

/**
 * Ticket icon — stacked-tickets silhouette.
 * Source: Lucide "tickets" icon (https://lucide.dev/icons/tickets),
 * ISC licensed (https://github.com/lucide-icons/lucide/blob/main/LICENSE).
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
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="m3.173 8.18 11-5a2 2 0 0 1 2.647.993L18.56 8" />
      <path d="M6 10V8" />
      <path d="M6 14v1" />
      <path d="M6 19v2" />
      <rect x="2" y="8" width="20" height="13" rx="2" />
    </svg>
  )
)

TicketIcon.displayName = 'TicketIcon'
