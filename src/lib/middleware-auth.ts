import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Middleware-compatible auth check that doesn't use bcrypt
 * This avoids Edge Runtime compatibility issues
 */
export async function getMiddlewareSession(request: NextRequest) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
    });

    if (!token) {
      return null;
    }

    return {
      user: {
        id: token.sub!,
        email: token.email,
        name: token.name,
        isAdmin: token.isAdmin as boolean,
      },
    };
  } catch (error) {
    console.error("Middleware auth error:", error);
    return null;
  }
}

/**
 * Check if a user is admin without using bcrypt
 * This is used in middleware and other Edge Runtime contexts
 */
export async function isAdminUser(request: NextRequest): Promise<boolean> {
  const session = await getMiddlewareSession(request);
  return !!session?.user.isAdmin;
}
