import { forwardRef } from "react";
import type { IconProps } from "../types";

/**
 * Plus icon for add/create actions
 */
export const PlusIcon = forwardRef<SVGSVGElement, IconProps>(
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
      <path d="M12 4v16m8-8H4" />
    </svg>
  )
);

PlusIcon.displayName = "PlusIcon";

