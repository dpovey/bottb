import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Shape variant of the skeleton
   * - rectangle: Default, with rounded corners
   * - circle: Perfect circle (use with equal width/height)
   * - text: Pill-shaped for text placeholders
   */
  variant?: "rectangle" | "circle" | "text";
}

/**
 * Skeleton loading placeholder with shimmer animation.
 * Respects prefers-reduced-motion for accessibility.
 *
 * @example
 * // Basic rectangle
 * <Skeleton className="h-8 w-32" />
 *
 * // Circle avatar
 * <Skeleton variant="circle" className="h-12 w-12" />
 *
 * // Text lines
 * <Skeleton variant="text" className="h-4 w-full" />
 * <Skeleton variant="text" className="h-4 w-3/4" />
 */
const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = "rectangle", ...props }, ref) => {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={cn(
          // Base styles - static background for reduced motion
          "bg-bg-elevated",

          // Shimmer animation (only when motion is allowed)
          "motion-safe:bg-gradient-to-r",
          "motion-safe:from-bg-elevated motion-safe:via-bg-surface motion-safe:to-bg-elevated",
          "motion-safe:bg-[length:200%_100%]",
          "motion-safe:animate-shimmer",

          // Shape variants
          {
            "rounded-lg": variant === "rectangle",
            "rounded-full": variant === "circle" || variant === "text",
          },

          className
        )}
        {...props}
      />
    );
  }
);

Skeleton.displayName = "Skeleton";

/**
 * Pre-composed skeleton for text content blocks
 */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={cn(
            "h-4",
            // Last line is shorter for natural appearance
            i === lines - 1 ? "w-2/3" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

/**
 * Pre-composed skeleton for card layouts
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/5 bg-bg-elevated p-6",
        className
      )}
    >
      <div className="flex items-center gap-4 mb-4">
        <Skeleton variant="circle" className="h-10 w-10" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="h-4 w-1/3" />
          <Skeleton variant="text" className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

export { Skeleton };

