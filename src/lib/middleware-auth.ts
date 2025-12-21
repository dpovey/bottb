import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// NextAuth v5 (Auth.js) uses "authjs" as the default cookie prefix
// This must match the prefix used by the auth configuration
const COOKIE_PREFIX = 'authjs'

/**
 * Middleware-compatible auth check that doesn't use bcrypt
 * This avoids Edge Runtime compatibility issues
 */
export async function getMiddlewareSession(request: NextRequest) {
  try {
    // Determine if we're in a secure context (production HTTPS)
    const isSecure =
      process.env.NODE_ENV === 'production' ||
      request.headers.get('x-forwarded-proto') === 'https'

    const cookieName = isSecure
      ? `__Secure-${COOKIE_PREFIX}.session-token`
      : `${COOKIE_PREFIX}.session-token`

    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      // NextAuth v5 uses "authjs" prefix by default, and adds "__Secure-" in production
      cookieName,
    })

    // Debug logging for production troubleshooting
    if (!token && process.env.NODE_ENV === 'production') {
      console.log('Middleware auth: No token found', {
        cookieName,
        isSecure,
        hasCookieHeader: !!request.headers.get('cookie'),
      })
    }

    if (!token) {
      return null
    }

    return {
      user: {
        id: token.sub!,
        email: token.email,
        name: token.name,
        isAdmin: token.isAdmin as boolean,
      },
    }
  } catch (error) {
    console.error('Middleware auth error:', error)
    return null
  }
}

/**
 * Check if a user is admin without using bcrypt
 * This is used in middleware and other Edge Runtime contexts
 */
export async function isAdminUser(request: NextRequest): Promise<boolean> {
  const session = await getMiddlewareSession(request)
  return !!session?.user.isAdmin
}
