import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { UserContext } from "./user-context";

/**
 * Set voting cookie to prevent double voting (client-side)
 */
export function setVotingCookie(
  eventId: string,
  voteData?: { bandId: string; bandName: string },
  expiresInDays: number = 30
): void {
  if (typeof document === "undefined") return;

  const expires = new Date();
  expires.setDate(expires.getDate() + expiresInDays);

  const cookieValue = voteData ? JSON.stringify(voteData) : "true";

  document.cookie = `voted_${eventId}=${encodeURIComponent(
    cookieValue
  )}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

/**
 * Check if user has voting cookie (client-side)
 */
export function hasVotingCookie(eventId: string): boolean {
  if (typeof document === "undefined") return false;

  return document.cookie.includes(`voted_${eventId}=`);
}

/**
 * Get vote data from cookie (client-side)
 */
export function getVoteFromCookie(
  eventId: string
): { bandId: string; bandName: string } | null {
  if (typeof document === "undefined") return null;

  const cookieName = `voted_${eventId}`;
  const cookies = document.cookie.split(";");

  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === cookieName && value) {
      try {
        const decodedValue = decodeURIComponent(value);
        // Check if it's JSON data (starts with {)
        if (decodedValue.startsWith("{")) {
          return JSON.parse(decodedValue);
        }
        // Otherwise it's just "true"
        return null;
      } catch (error) {
        console.error("Error parsing vote cookie:", error);
        return null;
      }
    }
  }

  return null;
}

/**
 * Get FingerprintJS data on the client side
 */
export async function getFingerprintJSData(): Promise<{
  visitorId: string;
  confidence: number;
  confidenceComment?: string;
  components: Record<string, unknown>;
} | null> {
  if (typeof window === "undefined") return null;

  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();

    return {
      visitorId: result.visitorId,
      confidence: result.confidence.score,
      confidenceComment: result.confidence.comment,
      components: result.components,
    };
  } catch (error) {
    console.error("Error getting FingerprintJS data:", error);
    return null;
  }
}

/**
 * Get client-side user context for frontend
 */
export function getClientUserContext(): Partial<UserContext> {
  if (typeof window === "undefined") return {};

  return {
    screen_resolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
  };
}



