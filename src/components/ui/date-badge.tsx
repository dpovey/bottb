import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface DateBadgeProps extends HTMLAttributes<HTMLDivElement> {
  date: Date | string;
  size?: "sm" | "md" | "lg";
  showYear?: boolean;
}

const DateBadge = forwardRef<HTMLDivElement, DateBadgeProps>(
  ({ className, date, size = "md", showYear = false, ...props }, ref) => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    
    const month = dateObj.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
    const day = dateObj.getDate();
    const year = dateObj.getFullYear();
    
    return (
      <div
        ref={ref}
        className={cn(
          // Glass effect background
          "bg-bg/60 backdrop-blur-md rounded border border-white/5 text-center",
          
          // Size variants
          {
            "px-2 py-1 min-w-[48px]": size === "sm",
            "px-3 py-2 min-w-[56px]": size === "md",
            "px-4 py-3 min-w-[72px]": size === "lg",
          },
          
          className
        )}
        {...props}
      >
        {/* Month */}
        <div
          className={cn(
            "tracking-wider uppercase text-text-muted",
            {
              "text-[10px]": size === "sm",
              "text-xs": size === "md" || size === "lg",
            }
          )}
        >
          {month}
        </div>
        
        {/* Day */}
        <div
          className={cn(
            "font-semibold text-white leading-tight",
            {
              "text-xl": size === "sm",
              "text-2xl": size === "md",
              "text-3xl": size === "lg",
            }
          )}
        >
          {day}
        </div>
        
        {/* Year (optional) */}
        {showYear && (
          <div
            className={cn(
              "text-text-dim",
              {
                "text-[10px]": size === "sm",
                "text-xs": size === "md" || size === "lg",
              }
            )}
          >
            {year}
          </div>
        )}
      </div>
    );
  }
);

DateBadge.displayName = "DateBadge";

export { DateBadge };


