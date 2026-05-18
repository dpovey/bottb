import { forwardRef } from 'react'
import type { IconProps } from '../types'

/**
 * Ticket icon — pair of overlapping tickets with side notches and a
 * vertical perforation line. Modelled on the reference design from
 * https://github.com/dpovey/bottb/pull/155 review.
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
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Back ticket — top peeking out from behind, slightly tilted */}
      <path d="M5 10 5.5 7 17.5 4.5 18 8.5" />
      {/* Front ticket with semi-circle notches centred on left & right edges */}
      <path d="M4.5 10H19.5A1.5 1.5 0 0 1 21 11.5V14A1 1 0 0 0 21 16V18.5A1.5 1.5 0 0 1 19.5 20H4.5A1.5 1.5 0 0 1 3 18.5V16A1 1 0 0 0 3 14V11.5A1.5 1.5 0 0 1 4.5 10Z" />
      {/* Content lines — top shorter, three longer below */}
      <path d="M6 13H10M6 15H14M6 17H14M6 19H14" />
      {/* Perforation dashes on the right side of the front ticket */}
      <path d="M16.5 11V12M16.5 13V14M16.5 15V16M16.5 17V18M16.5 19V19.5" />
    </svg>
  )
)

TicketIcon.displayName = 'TicketIcon'
