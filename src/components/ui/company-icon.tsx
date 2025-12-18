"use client";

import { cn } from "@/lib/utils";

interface CompanyIconProps {
  /** Company icon URL */
  iconUrl?: string | null;
  /** Company logo URL (fallback if no icon) */
  logoUrl?: string | null;
  /** Company name for alt text */
  companyName: string;
  /** Size of the icon */
  size?: "xs" | "sm" | "md" | "lg";
  /** Additional classes */
  className?: string;
  /** Whether to show a fallback icon when no image is available */
  showFallback?: boolean;
}

const sizeClasses = {
  xs: "w-4 h-4",
  sm: "w-5 h-5",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

/**
 * Company icon component that displays the company's icon or logo
 * Falls back to a building icon if no image is available
 */
export function CompanyIcon({
  iconUrl,
  logoUrl,
  companyName,
  size = "sm",
  className,
  showFallback = true,
}: CompanyIconProps) {
  const imageUrl = iconUrl || logoUrl;

  if (!imageUrl) {
    if (!showFallback) {
      return null;
    }
    // Fallback to building icon
    return (
      <div
        className={cn(
          "rounded flex items-center justify-center bg-white/10",
          sizeClasses[size],
          className
        )}
        title={companyName}
      >
        <svg
          className="w-3/4 h-3/4 text-text-dim"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      </div>
    );
  }

  return (
    // Using native img for dynamic blob URLs
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={`${companyName} logo`}
      title={companyName}
      className={cn(
        "object-contain rounded",
        sizeClasses[size],
        className
      )}
    />
  );
}




