import { forwardRef } from "react";
import type { IconProps } from "../types";

/**
 * Ticket icon for events
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
      <path d="M2 9a3 3 0 013-3h14a3 3 0 013 3v0a3 3 0 01-3 3v0a3 3 0 00-3 3v0a3 3 0 01-3 3H5a3 3 0 01-3-3v-6z" />
      <path d="M13 6v3M13 15v3" />
    </svg>
  )
);

TicketIcon.displayName = "TicketIcon";

