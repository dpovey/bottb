import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "outline" | "filled" | "accent" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "outline", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Base styles
          "inline-flex items-center justify-center gap-2 font-medium transition-all duration-300",
          "tracking-widest uppercase disabled:opacity-50 disabled:pointer-events-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          
          // Size variants
          {
            "text-xs px-4 py-2 rounded-full": size === "sm",
            "text-sm px-6 py-3 rounded-full": size === "md",
            "text-sm px-8 py-4 rounded-full": size === "lg",
          },
          
          // Style variants
          {
            // Outline (default) - white border, transparent bg
            "border border-white/30 text-white hover:border-white/60 hover:bg-white/5":
              variant === "outline",
            
            // Filled - white bg, dark text
            "bg-white text-bg hover:bg-gray-200":
              variant === "filled",
            
            // Accent - accent color bg
            "bg-accent text-white hover:bg-accent-light":
              variant === "accent",
            
            // Ghost - no border, just text
            "text-text-muted hover:text-white hover:bg-white/5":
              variant === "ghost",
            
            // Danger - for destructive actions
            "bg-error/20 border border-error/30 text-error hover:bg-error/30":
              variant === "danger",
          },
          
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
