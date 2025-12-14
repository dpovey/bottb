import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "accent" | "error" | "success" | "warning" | "info";
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          // Base styles
          "inline-flex items-center px-3 py-1 rounded text-xs font-medium tracking-wider uppercase",
          
          // Variant styles
          {
            // Default - outline style
            "bg-white/10 border border-white/20 text-white":
              variant === "default",
            
            // Accent - for winners, featured, selected
            "bg-accent/20 border border-accent/30 text-accent":
              variant === "accent",
            
            // Error - for errors, cancelled
            "bg-error/20 border border-error/30 text-error":
              variant === "error",
            
            // Success - for completed, confirmed
            "bg-success/20 border border-success/30 text-success":
              variant === "success",
            
            // Warning - for attention needed
            "bg-warning/20 border border-warning/30 text-warning":
              variant === "warning",
            
            // Info - for informational
            "bg-info/20 border border-info/30 text-info":
              variant === "info",
          },
          
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";

export { Badge };

