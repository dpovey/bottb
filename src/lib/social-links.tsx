import { ReactNode } from "react";
import {
  LinkedInIcon,
  YouTubeIcon,
  InstagramIcon,
  FacebookIcon,
  TikTokIcon,
} from "@/components/icons";

/**
 * Social platform definitions with icons and URL patterns.
 * The URL pattern uses {handle} as a placeholder for the account name.
 */
type SocialPlatform = {
  name: string;
  urlPattern: string;
  icon: (className?: string) => ReactNode;
};

const platforms: Record<string, SocialPlatform> = {
  linkedin: {
    name: "LinkedIn",
    urlPattern: "https://linkedin.com/company/{handle}",
    icon: (className = "w-5 h-5") => <LinkedInIcon className={className} />,
  },
  youtube: {
    name: "YouTube",
    urlPattern: "https://youtube.com/@{handle}",
    icon: (className = "w-5 h-5") => <YouTubeIcon className={className} />,
  },
  instagram: {
    name: "Instagram",
    urlPattern: "https://instagram.com/{handle}",
    icon: (className = "w-5 h-5") => <InstagramIcon className={className} />,
  },
  facebook: {
    name: "Facebook",
    urlPattern: "https://facebook.com/{handle}",
    icon: (className = "w-5 h-5") => <FacebookIcon className={className} />,
  },
  tiktok: {
    name: "TikTok",
    urlPattern: "https://tiktok.com/@{handle}",
    icon: (className = "w-5 h-5") => <TikTokIcon className={className} />,
  },
};

// =============================================================================
// BOTTB Social Account Configuration
// =============================================================================
// Edit these values to update social links site-wide.
// Use account handles OR full URLs (for platforms like Facebook with profile IDs).
// The order here determines the display order.

const bottbAccounts = {
  linkedin: "battle-of-the-tech-bands",
  youtube: "battleofthetechbands",
  instagram: "battleofthetechbands",
  facebook: "battleofthetechbands",
  tiktok: "bottb0",
} as const;

// =============================================================================
// Exports
// =============================================================================

export type SocialLink = {
  platform: string;
  href: string;
  label: string;
  icon: (className?: string) => ReactNode;
};

/**
 * Build URL from handle or return full URL if already provided.
 */
function buildUrl(urlPattern: string, handleOrUrl: string): string {
  // If it's already a full URL, use it directly
  if (handleOrUrl.startsWith("http://") || handleOrUrl.startsWith("https://")) {
    return handleOrUrl;
  }
  return urlPattern.replace("{handle}", handleOrUrl);
}

/**
 * Get social links for BOTTB.
 * Returns an array of social link objects with href, label, and icon.
 */
export function getSocialLinks(iconClassName?: string): SocialLink[] {
  return Object.entries(bottbAccounts).map(([platformKey, handleOrUrl]) => {
    const platform = platforms[platformKey];
    return {
      platform: platformKey,
      href: buildUrl(platform.urlPattern, handleOrUrl),
      label: platform.name,
      icon: (className?: string) => platform.icon(className ?? iconClassName),
    };
  });
}

/**
 * Pre-built social links with default icon size for convenience.
 */
export const socialLinks = getSocialLinks();

/**
 * Get a single social link by platform name.
 */
export function getSocialLink(
  platformKey: keyof typeof bottbAccounts,
  iconClassName?: string
): SocialLink | undefined {
  const handleOrUrl = bottbAccounts[platformKey];
  const platform = platforms[platformKey];
  if (!platform) return undefined;

  return {
    platform: platformKey,
    href: buildUrl(platform.urlPattern, handleOrUrl),
    label: platform.name,
    icon: (className?: string) => platform.icon(className ?? iconClassName),
  };
}

/**
 * Get the icon component for a platform.
 * Useful when you need just the icon without the full link data.
 */
export function getSocialIcon(
  platformKey: keyof typeof platforms
): ((className?: string) => ReactNode) | undefined {
  return platforms[platformKey]?.icon;
}
