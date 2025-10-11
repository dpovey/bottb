// Integration example for FingerprintJS
// First install: npm install @fingerprintjs/fingerprintjs

import FingerprintJS from "@fingerprintjs/fingerprintjs";
import crypto from "crypto";

export interface FingerprintResult {
  visitorId: string;
  confidence: number;
  confidenceComment?: string;
  components: Record<string, unknown>;
}

/**
 * Get browser fingerprint using FingerprintJS
 * This provides more accurate and stable fingerprints than our custom implementation
 */
export async function getBrowserFingerprint(): Promise<FingerprintResult> {
  if (typeof window === "undefined") {
    throw new Error("FingerprintJS can only be used in browser environment");
  }

  // Initialize FingerprintJS
  const fp = await FingerprintJS.load();

  // Get the fingerprint
  const result = await fp.get();

  return {
    visitorId: result.visitorId,
    confidence: result.confidence.score,
    confidenceComment: result.confidence.comment,
    components: result.components,
  };
}

/**
 * Enhanced user context with FingerprintJS data
 */
export async function getEnhancedUserContext(): Promise<{
  fingerprint: string;
  confidence: number;
  components: Record<string, unknown>;
  customContext: {
    screen_resolution?: string;
    timezone?: string;
    language?: string;
  };
}> {
  const fingerprint = await getBrowserFingerprint();
  const customContext = {
    screen_resolution:
      typeof window !== "undefined"
        ? `${window.screen.width}x${window.screen.height}`
        : undefined,
    timezone:
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : undefined,
    language: typeof navigator !== "undefined" ? navigator.language : undefined,
  };

  return {
    fingerprint: fingerprint.visitorId,
    confidence: fingerprint.confidence,
    components: fingerprint.components,
    customContext,
  };
}

/**
 * Hybrid approach: Combine FingerprintJS with your custom fingerprint
 * This gives you the best of both worlds
 */
export async function getHybridFingerprint(
  ip: string,
  userAgent: string,
  eventId: string
): Promise<{
  fingerprintjs: string;
  custom: string;
  hybrid: string;
}> {
  const fpResult = await getBrowserFingerprint();

  // Your existing custom fingerprint
  const customFingerprint = crypto
    .createHash("sha256")
    .update(
      [ip, userAgent, eventId, new Date().toISOString().split("T")[0]].join("|")
    )
    .digest("hex");

  // Hybrid: combine both for maximum accuracy
  const hybridFingerprint = crypto
    .createHash("sha256")
    .update([fpResult.visitorId, customFingerprint].join("|"))
    .digest("hex");

  return {
    fingerprintjs: fpResult.visitorId,
    custom: customFingerprint,
    hybrid: hybridFingerprint,
  };
}
