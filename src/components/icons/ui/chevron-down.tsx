import { forwardRef } from "react";
import type { IconProps } from "../types";

/**
 * Chevron pointing down - for dropdowns, accordions
 */
export const ChevronDownIcon = forwardRef<SVGSVGElement, IconProps>(
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
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
);

ChevronDownIcon.displayName = "ChevronDownIcon";

