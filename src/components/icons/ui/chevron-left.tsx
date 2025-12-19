import { forwardRef } from "react";
import type { IconProps } from "../types";

/**
 * Chevron pointing left - for navigation, "back" actions
 */
export const ChevronLeftIcon = forwardRef<SVGSVGElement, IconProps>(
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
      <path d="M15 19l-7-7 7-7" />
    </svg>
  )
);

ChevronLeftIcon.displayName = "ChevronLeftIcon";

