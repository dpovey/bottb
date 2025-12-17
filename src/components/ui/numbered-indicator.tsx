"use client";

import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface NumberedIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  /** The number to display */
  number: number | string;
  /** Shape of the indicator */
  shape?: "circle" | "square";
  /** Size variant */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Visual variant */
  variant?: "default" | "muted" | "winner" | "accent" | "rank-1" | "rank-2" | "rank-3";
}

const sizeClasses = {
  xs: "w-5 h-5 text-xs",
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-base",
  xl: "w-12 h-12 text-lg",
};

const shapeClasses = {
  circle: "rounded-full",
  square: "rounded-lg",
};

const variantClasses = {
  default: "bg-bg-surface text-text-muted",
  muted: "bg-white/5 text-text-muted",
  winner: "bg-warning/20 text-warning",
  accent: "bg-accent/20 text-accent",
  "rank-1": "bg-warning/20 text-warning", // Gold for 1st
  "rank-2": "bg-white/10 text-text-muted", // Silver-ish for 2nd
  "rank-3": "bg-amber-900/30 text-amber-600", // Bronze for 3rd
};

/**
 * NumberedIndicator - Displays a number in a styled container
 * 
 * Use cases:
 * - Band order in lists (square, lg, muted)
 * - Setlist song positions (circle, md, default)
 * - Ranking positions (circle, md, rank-1/2/3)
 * - Table row numbers (circle, sm, default)
 */
const NumberedIndicator = forwardRef<HTMLDivElement, NumberedIndicatorProps>(
  (
    {
      className,
      number,
      shape = "circle",
      size = "md",
      variant = "default",
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base styles
          "flex items-center justify-center shrink-0 font-medium",
          // Size
          sizeClasses[size],
          // Shape
          shapeClasses[shape],
          // Variant
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {number}
      </div>
    );
  }
);

NumberedIndicator.displayName = "NumberedIndicator";

export { NumberedIndicator };

