import Link from "next/link";
import { cn } from "@/lib/utils";

export interface CompanyBadgeProps {
  /** Company slug for linking */
  slug: string;
  /** Company display name */
  name: string;
  /** Visual style variant */
  variant?: "default" | "inline" | "pill";
  /** Size variant */
  size?: "sm" | "md";
  /** Additional CSS classes */
  className?: string;
  /** Whether to show as a link (defaults to true) */
  asLink?: boolean;
}

/**
 * Displays a company name as a badge or link
 *
 * Variants:
 * - default: Subtle pill badge style
 * - inline: Text link style for inline use
 * - pill: More prominent pill style
 */
export function CompanyBadge({
  slug,
  name,
  variant = "default",
  size = "md",
  className,
  asLink = true,
}: CompanyBadgeProps) {
  const baseStyles = "transition-colors";

  const variantStyles = {
    default: cn(
      "inline-flex items-center gap-1.5 rounded-full",
      "bg-white/5 border border-white/10",
      "text-text-muted hover:text-white hover:border-white/20",
      size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
    ),
    inline: cn(
      "text-text-muted hover:text-accent",
      size === "sm" ? "text-xs" : "text-sm"
    ),
    pill: cn(
      "inline-flex items-center gap-1.5 rounded-full",
      "bg-accent/10 border border-accent/20",
      "text-accent hover:bg-accent/20",
      size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
    ),
  };

  const content = (
    <>
      {variant !== "inline" && (
        <svg
          className={cn("shrink-0", size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      )}
      <span className="truncate">{name}</span>
    </>
  );

  const combinedClassName = cn(baseStyles, variantStyles[variant], className);

  if (asLink) {
    return (
      <Link href={`/companies?company=${slug}`} className={combinedClassName}>
        {content}
      </Link>
    );
  }

  return <span className={combinedClassName}>{content}</span>;
}
