import Link from "next/link";
import { BuildingIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface CompanyBadgeProps {
  /** Company slug for linking */
  slug: string;
  /** Company display name */
  name: string;
  /** Company icon URL (optional - falls back to building icon) */
  iconUrl?: string | null;
  /** Visual style variant */
  variant?: "default" | "inline" | "pill" | "muted";
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
 * - muted: Monochrome outline style
 */
export function CompanyBadge({
  slug,
  name,
  iconUrl,
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
      "inline-flex items-center gap-1.5",
      "text-text-muted hover:text-accent",
      size === "sm" ? "text-xs" : "text-sm"
    ),
    pill: cn(
      "inline-flex items-center gap-1.5 rounded-full",
      "bg-accent/10 border border-accent/20",
      "text-accent hover:bg-accent/20",
      size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
    ),
    muted: cn(
      "inline-flex items-center gap-1.5 rounded-full",
      "border border-white/20",
      "text-text-muted",
      size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
    ),
  };

  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  // Show icon for non-inline variants, OR for inline if iconUrl is provided
  const showIcon = variant !== "inline" || !!iconUrl;
  
  const content = (
    <>
      {showIcon && (
        iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconUrl}
            alt={`${name} icon`}
            className={cn("shrink-0 object-contain", iconSize)}
          />
        ) : (
          <BuildingIcon className={cn("shrink-0", iconSize)} />
        )
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

