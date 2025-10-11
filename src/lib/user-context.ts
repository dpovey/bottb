import { NextRequest } from "next/server";
import crypto from "crypto";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { sql } from "@vercel/postgres";

export interface UserContext {
  ip_address?: string;
  user_agent?: string;
  browser_name?: string;
  browser_version?: string;
  os_name?: string;
  os_version?: string;
  device_type?: string;
  screen_resolution?: string;
  timezone?: string;
  language?: string;
  google_click_id?: string;
  facebook_pixel_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  vote_fingerprint?: string;
  // FingerprintJS fields
  fingerprintjs_visitor_id?: string;
  fingerprintjs_confidence?: number;
  fingerprintjs_confidence_comment?: string;
}

export interface BrowserInfo {
  name: string;
  version: string;
  os: string;
  osVersion: string;
  deviceType: string;
}

/**
 * Extract user context from request headers and cookies
 */
export function extractUserContext(request: NextRequest): UserContext {
  const userAgent = request.headers.get("user-agent") || "";
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  // Get IP address (prioritize Cloudflare, then X-Real-IP, then X-Forwarded-For)
  const ipAddress =
    cfConnectingIp ||
    realIp ||
    (forwardedFor ? forwardedFor.split(",")[0].trim() : null);

  // Parse browser info from user agent
  const browserInfo = parseUserAgent(userAgent);

  // Extract UTM parameters from URL
  let utmParams = {};
  let eventId = "";
  try {
    const url = new URL(request.url);
    utmParams = extractUtmParams(url);
    eventId = url.searchParams.get("eventId") || "";
  } catch {
    console.warn("Invalid URL in request:", request.url);
  }

  // Extract tracking IDs from cookies
  const trackingIds = extractTrackingIds(request);

  // Generate vote fingerprint for duplicate detection
  const voteFingerprint = generateVoteFingerprint({
    ip: ipAddress,
    userAgent,
    eventId,
    timestamp: new Date().toISOString().split("T")[0], // Daily fingerprint
  });

  return {
    ip_address: ipAddress || undefined,
    user_agent: userAgent || undefined,
    browser_name: browserInfo.name,
    browser_version: browserInfo.version,
    os_name: browserInfo.os,
    os_version: browserInfo.osVersion,
    device_type: browserInfo.deviceType,
    screen_resolution: request.headers.get("x-screen-resolution") || undefined,
    timezone: request.headers.get("x-timezone") || undefined,
    language:
      request.headers.get("accept-language")?.split(",")[0] || undefined,
    ...trackingIds,
    ...utmParams,
    vote_fingerprint: voteFingerprint,
  };
}

/**
 * Parse user agent string to extract browser and OS information
 */
export function parseUserAgent(userAgent: string): BrowserInfo {
  const ua = userAgent.toLowerCase();

  // Browser detection
  let browserName = "Unknown";
  let browserVersion = "Unknown";

  if (ua.includes("chrome") && !ua.includes("edg")) {
    browserName = "Chrome";
    const match = ua.match(/chrome\/(\d+\.\d+)/);
    browserVersion = match ? match[1] : "Unknown";
  } else if (ua.includes("firefox")) {
    browserName = "Firefox";
    const match = ua.match(/firefox\/(\d+\.\d+)/);
    browserVersion = match ? match[1] : "Unknown";
  } else if (ua.includes("safari") && !ua.includes("chrome")) {
    browserName = "Safari";
    const match = ua.match(/version\/(\d+\.\d+)/);
    browserVersion = match ? match[1] : "Unknown";
  } else if (ua.includes("edg")) {
    browserName = "Edge";
    const match = ua.match(/edg\/(\d+\.\d+)/);
    browserVersion = match ? match[1] : "Unknown";
  }

  // OS detection
  let osName = "Unknown";
  let osVersion = "Unknown";

  if (ua.includes("windows")) {
    osName = "Windows";
    if (ua.includes("windows nt 10.0")) osVersion = "10";
    else if (ua.includes("windows nt 6.3")) osVersion = "8.1";
    else if (ua.includes("windows nt 6.2")) osVersion = "8";
    else if (ua.includes("windows nt 6.1")) osVersion = "7";
  } else if (ua.includes("iphone") || ua.includes("ipad")) {
    osName = "iOS";
    const match = ua.match(/os (\d+[._]\d+)/);
    osVersion = match ? match[1].replace("_", ".") : "Unknown";
  } else if (
    ua.includes("mobile") &&
    ua.includes("safari") &&
    ua.includes("os")
  ) {
    osName = "iOS";
    const match = ua.match(/os (\d+[._]\d+)/);
    osVersion = match ? match[1].replace("_", ".") : "Unknown";
  } else if (ua.includes("mac os x")) {
    osName = "macOS";
    const match = ua.match(/mac os x (\d+[._]\d+)/);
    osVersion = match ? match[1].replace("_", ".") : "Unknown";
  } else if (ua.includes("linux")) {
    osName = "Linux";
  } else if (ua.includes("android")) {
    osName = "Android";
    const match = ua.match(/android (\d+\.\d+)/);
    osVersion = match ? match[1] : "Unknown";
  }

  // Device type detection
  let deviceType = "Desktop";
  if (ua.includes("mobile")) {
    deviceType = "Mobile";
  } else if (ua.includes("tablet") || ua.includes("ipad")) {
    deviceType = "Tablet";
  }

  return {
    name: browserName,
    version: browserVersion,
    os: osName,
    osVersion: osVersion,
    deviceType: deviceType,
  };
}

/**
 * Extract UTM parameters from URL
 */
function extractUtmParams(url: URL): Partial<UserContext> {
  return {
    utm_source: url.searchParams.get("utm_source") || undefined,
    utm_medium: url.searchParams.get("utm_medium") || undefined,
    utm_campaign: url.searchParams.get("utm_campaign") || undefined,
    utm_term: url.searchParams.get("utm_term") || undefined,
    utm_content: url.searchParams.get("utm_content") || undefined,
  };
}

/**
 * Extract tracking IDs from cookies
 */
function extractTrackingIds(request: NextRequest): Partial<UserContext> {
  const cookies = request.cookies;

  return {
    google_click_id: cookies.get("gclid")?.value || undefined,
    facebook_pixel_id: cookies.get("_fbp")?.value || undefined,
  };
}

/**
 * Generate a unique fingerprint for vote deduplication
 */
export function generateVoteFingerprint(context: {
  ip?: string | null;
  userAgent: string;
  eventId: string;
  timestamp: string;
}): string {
  const fingerprintData = [
    context.ip || "unknown",
    context.userAgent,
    context.eventId,
    context.timestamp,
  ].join("|");

  return crypto.createHash("sha256").update(fingerprintData).digest("hex");
}

/**
 * Check if user has already voted for an event (server-side)
 */
export async function hasUserVoted(
  eventId: string,
  fingerprint: string
): Promise<boolean> {
  const { rows } = await sql`
    SELECT 1 FROM votes 
    WHERE event_id = ${eventId} 
    AND vote_fingerprint = ${fingerprint}
    LIMIT 1
  `;

  return rows.length > 0;
}

/**
 * Check if user has already voted using FingerprintJS visitor ID
 */
export async function hasUserVotedByFingerprintJS(
  eventId: string,
  visitorId: string
): Promise<boolean> {
  console.log("🔍 hasUserVotedByFingerprintJS - Event ID:", eventId);
  console.log("🔍 hasUserVotedByFingerprintJS - Visitor ID:", visitorId);

  // Let's also check what votes exist for this event
  const { rows: allVotesForEvent } = await sql`
    SELECT event_id, fingerprintjs_visitor_id, voter_type, created_at 
    FROM votes 
    WHERE event_id = ${eventId}
  `;
  console.log("🔍 All votes for this event:", allVotesForEvent);

  const { rows } = await sql`
    SELECT 1 FROM votes 
    WHERE event_id = ${eventId} 
    AND fingerprintjs_visitor_id = ${visitorId}
    LIMIT 1
  `;

  console.log(
    "🔍 hasUserVotedByFingerprintJS - Query result rows:",
    rows.length
  );
  console.log("🔍 hasUserVotedByFingerprintJS - Rows:", rows);

  return rows.length > 0;
}

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
