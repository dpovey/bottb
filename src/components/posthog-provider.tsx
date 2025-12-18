"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

/**
 * PostHog Provider - Wraps app with PostHog React context and tracks page views
 * 
 * PostHog initialization is handled by instrumentation-client.ts (Next.js 15.3+ best practice).
 * This provider:
 * - Wraps the app with PostHog's React context
 * - Tracks page views when routes change (after navigation completes)
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page views on route changes with environment metadata
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "test") return;
    // Check if PostHog is actually initialized (not just has the method)
    const isInitialized = posthog && (posthog as { __loaded?: boolean }).__loaded === true;
    if (!isInitialized) return;

    const nodeEnv = process.env.NODE_ENV;
    const hostname = window.location.hostname;

    const isDev =
      nodeEnv === "development" ||
      hostname.includes("localhost") ||
      hostname.includes("127.0.0.1") ||
      (hostname.includes(".vercel.app") && !hostname.includes("bottb"));

    posthog.capture("$pageview", {
      $current_url: window.location.href,
      // Add environment metadata for filtering in PostHog
      environment: nodeEnv || "unknown",
      is_development: isDev ? "true" : "false",
      is_production: nodeEnv === "production" && !isDev ? "true" : "false",
    });
  }, [pathname, searchParams]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

