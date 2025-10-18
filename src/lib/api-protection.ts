import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Session } from "next-auth";

export type ApiHandler = (
  request: NextRequest,
  context?: unknown
) => Promise<NextResponse>;

export type ProtectedApiHandler = (
  request: NextRequest,
  context?: unknown,
  session?: Session
) => Promise<NextResponse>;

/**
 * Higher-order function to protect API routes with admin authentication
 */
export function withAdminAuth(handler: ProtectedApiHandler): ApiHandler {
  return async (request: NextRequest, context?: unknown) => {
    try {
      const session = await auth();

      if (!session?.user || !session.user.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized - Admin access required" },
          { status: 401 }
        );
      }

      return await handler(request, context, session);
    } catch (_error) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 500 }
      );
    }
  };
}

/**
 * Higher-order function to protect API routes with user authentication (any logged-in user)
 */
export function withAuth(handler: ProtectedApiHandler): ApiHandler {
  return async (request: NextRequest, context?: unknown) => {
    try {
      const session = await auth();

      if (!session?.user) {
        return NextResponse.json(
          { error: "Unauthorized - Authentication required" },
          { status: 401 }
        );
      }

      return await handler(request, context, session);
    } catch (_error) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 500 }
      );
    }
  };
}

/**
 * Rate limiting store (in-memory for now, consider Redis for production)
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Clear rate limit store (for testing)
 */
export function clearRateLimitStore() {
  rateLimitStore.clear();
}

/**
 * Rate limiting configuration
 */
const RATE_LIMITS = {
  // Public voting endpoints - more restrictive
  vote: { requests: 10, windowMs: 60 * 1000 }, // 10 requests per minute
  // General API endpoints
  api: { requests: 100, windowMs: 60 * 1000 }, // 100 requests per minute
  // Admin endpoints - more permissive
  admin: { requests: 200, windowMs: 60 * 1000 }, // 200 requests per minute
} as const;

/**
 * Higher-order function to add rate limiting to API routes
 */
export function withRateLimit(
  handler: ApiHandler,
  limitType: keyof typeof RATE_LIMITS = "api"
): ApiHandler {
  return async (request: NextRequest, context?: unknown) => {
    const clientId = getClientIdentifier(request);
    const limit = RATE_LIMITS[limitType];
    const now = Date.now();
    const _windowStart = now - limit.windowMs;

    // Clean up old entries
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }

    const current = rateLimitStore.get(clientId);

    if (!current || current.resetTime < now) {
      // New window or expired
      rateLimitStore.set(clientId, {
        count: 1,
        resetTime: now + limit.windowMs,
      });
    } else if (current.count >= limit.requests) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((current.resetTime - now) / 1000);
      const response = NextResponse.json(
        {
          error: "Too many requests",
          retryAfter,
          limit: limit.requests,
          windowMs: limit.windowMs,
        },
        {
          status: 429,
        }
      );

      // Add headers manually
      response.headers.set("Retry-After", retryAfter.toString());
      response.headers.set("X-RateLimit-Limit", limit.requests.toString());
      response.headers.set("X-RateLimit-Remaining", "0");
      response.headers.set("X-RateLimit-Reset", current.resetTime.toString());

      return response;
    } else {
      // Increment counter
      current.count++;
    }

    // Add rate limit headers to all responses
    const response = await handler(request, context);

    // Add rate limit headers
    const remaining = Math.max(0, limit.requests - (current?.count || 1));
    const resetTime = current?.resetTime || now + limit.windowMs;

    response.headers.set("X-RateLimit-Limit", limit.requests.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    response.headers.set("X-RateLimit-Reset", resetTime.toString());

    return response;
  };
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get a stable identifier
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0] || realIp || "unknown";

  // Add user agent for additional uniqueness
  const userAgent = request.headers.get("user-agent") || "unknown";

  return `${ip}-${userAgent.slice(0, 50)}`;
}

/**
 * Combined protection: admin auth + rate limiting
 */
export function withAdminProtection(handler: ProtectedApiHandler): ApiHandler {
  return withRateLimit(withAdminAuth(handler), "admin");
}

/**
 * Combined protection: user auth + rate limiting
 */
export function withUserProtection(handler: ProtectedApiHandler): ApiHandler {
  return withRateLimit(withAuth(handler), "api");
}

/**
 * Public endpoint with rate limiting only
 */
export function withPublicRateLimit(handler: ApiHandler): ApiHandler {
  return withRateLimit(handler, "api");
}

/**
 * Voting endpoint with stricter rate limiting
 */
export function withVoteRateLimit(handler: ApiHandler): ApiHandler {
  return withRateLimit(handler, "vote");
}

/**
 * Direct admin authentication check (for use in API routes)
 */
export async function requireAdminAuth(_request: NextRequest): Promise<void> {
  const session = await auth();

  if (!session?.user || !session.user.isAdmin) {
    throw new Error("Unauthorized - Admin access required");
  }
}
