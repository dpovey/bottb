"use client";

import { track } from "@vercel/analytics";
import posthog from "posthog-js";

/**
 * Check if analytics should be enabled
 * Disable in test environments
 */
function isAnalyticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "test") return false;
  return true;
}

/**
 * Get environment metadata for filtering in PostHog
 * This allows you to filter out dev/test events in PostHog dashboard
 * 
 * In PostHog, you can filter insights by:
 * - environment = "production" (only production events)
 * - is_development = "false" (exclude localhost/dev)
 */
function getEnvironmentMetadata(): Record<string, string> {
  const nodeEnv = process.env.NODE_ENV;
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  
  // Detect if we're in development (localhost, dev domains, or NODE_ENV=development)
  const isDev = 
    nodeEnv === "development" || 
    hostname.includes("localhost") || 
    hostname.includes("127.0.0.1") ||
    hostname.includes(".vercel.app") && !hostname.includes("bottb"); // Vercel preview URLs

  return {
    environment: nodeEnv || "unknown",
    is_development: isDev ? "true" : "false",
    is_production: nodeEnv === "production" && !isDev ? "true" : "false",
  };
}

/**
 * Track an event to both Vercel Analytics and PostHog
 * 
 * Single Project Setup (filtering approach):
 * - Events automatically include environment metadata for filtering
 * - Test environment: Events are not tracked (returns early)
 * - Development: Tracked with is_development="true" (can be filtered in PostHog)
 * - Production: Tracked with is_production="true"
 * 
 * To filter in PostHog:
 * - Add filter: is_production = "true" (only production events)
 * - Or: is_development = "false" (exclude dev events)
 * - Or: environment = "production" (only production environment)
 */
export function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>
): void {
  if (!isAnalyticsEnabled()) return;
  
  // Get environment metadata first
  const envMetadata = getEnvironmentMetadata();
  
  // Optional: Skip PostHog tracking in development if env var is set
  // Set NEXT_PUBLIC_DISABLE_DEV_TRACKING=true to disable dev tracking to PostHog
  const shouldSkipPostHog = 
    process.env.NEXT_PUBLIC_DISABLE_DEV_TRACKING === "true" &&
    envMetadata.is_development === "true";
  
  // Always track to Vercel Analytics
  // Vercel Analytics expects properties to be string | number | boolean | null
  // Our properties already conform to this, so we cast safely
  track(eventName, properties as Record<string, string | number | boolean | null> | undefined);
  
  // Skip PostHog if disabled for dev
  if (shouldSkipPostHog) return;

  // Add environment metadata to all events for filtering in PostHog
  const enrichedProperties = {
    ...properties,
    ...envMetadata,
  };

  // Track to PostHog (only if initialized and not skipped)
  if (typeof window !== "undefined") {
    try {
      // Check if PostHog is initialized
      // PostHog sets __loaded to true when fully initialized
      // We need to check this to avoid calling capture before init completes
      const isInitialized = posthog && (posthog as { __loaded?: boolean }).__loaded === true;
      
      if (isInitialized) {
        try {
          posthog.capture(eventName, enrichedProperties);
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error(`[PostHog] Error capturing event ${eventName}:`, error);
          }
        }
      }
    } catch (error) {
      // PostHog not initialized or error occurred
      if (process.env.NODE_ENV === "development") {
        console.error("[PostHog] Error tracking event:", error);
      }
    }
  }
}

/**
 * Photo-specific tracking functions
 */

export function trackPhotoDownload(properties: {
  photo_id: string;
  event_id?: string | null;
  band_id?: string | null;
  photographer?: string | null;
  event_name?: string | null;
  band_name?: string | null;
}): void {
  trackEvent("photo:download", properties);
}

export function trackPhotoShare(properties: {
  photo_id: string;
  share_method: "copy_link" | "linkedin" | "facebook" | "instagram";
  event_id?: string | null;
  band_id?: string | null;
  event_name?: string | null;
  band_name?: string | null;
}): void {
  trackEvent("photo:share", properties);
}

export function trackPhotoView(properties: {
  photo_id: string;
  event_id?: string | null;
  band_id?: string | null;
  event_name?: string | null;
  band_name?: string | null;
  view_duration?: number;
}): void {
  trackEvent("photo:view", properties);
}

export function trackPhotoClick(properties: {
  photo_id: string;
  event_id?: string | null;
  band_id?: string | null;
  event_name?: string | null;
  band_name?: string | null;
}): void {
  trackEvent("photo:click", properties);
}

export function trackPhotoFilterChange(properties: {
  filter_type: "event" | "band" | "photographer" | "company";
  filter_value: string | null;
}): void {
  trackEvent("photo:filter_changed", properties);
}

export function trackSocialLinkClick(properties: {
  platform: string;
  location: string;
  url: string;
}): void {
  trackEvent("social:link_clicked", properties);
}

export function trackVideoClick(properties: {
  video_id: string;
  video_title: string;
  youtube_video_id: string;
  event_id?: string | null;
  band_id?: string | null;
  event_name?: string | null;
  band_name?: string | null;
  company_name?: string | null;
  location?: string; // Where the video was clicked (e.g., "event_page", "band_page")
}): void {
  trackEvent("video:clicked", properties);
}

export function trackSubscribeClick(properties: {
  location: string; // Where the subscribe button was clicked (e.g., "video_carousel")
  url: string;
}): void {
  trackEvent("youtube:subscribe_clicked", properties);
}

/**
 * Track navigation clicks for analytics and A/B testing
 */
export function trackNavClick(properties: {
  nav_item: string; // The specific item clicked (e.g., "photos", "bands")
  nav_section?: string; // The section/dropdown it belongs to (e.g., "lineup", "gallery")
  variant?: string; // For A/B test tracking (e.g., "gallery", "highlights", "relive")
  location: "header" | "footer" | "mobile_menu";
}): void {
  trackEvent("nav:click", properties);
}

