/**
 * Feature flag constants and types for PostHog experiments
 */

export const FEATURE_FLAGS = {
  /** A/B test for the navigation media section label */
  NAV_MEDIA_LABEL: "nav-media-label-experiment",
} as const;

/**
 * Payload type for the nav-media-label-experiment feature flag
 * Configured in PostHog with variants: gallery, highlights, relive
 * Each variant has a payload like: { "label": "Gallery" }
 */
export interface NavMediaLabelPayload {
  label: string;
}

/** Default label if feature flag is not loaded */
export const DEFAULT_NAV_MEDIA_LABEL = "Gallery";

