import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { timingSafeEqual } from 'crypto'
import { auth } from '@/lib/auth'
import { withRateLimit } from '@/lib/api-protection'

/**
 * On-demand cache revalidation for the public site.
 *
 * Two callers, two auth modes:
 *  - The "Refresh public cache" admin button → authenticated by admin session.
 *  - CLI scripts (create-event, upload-event-image, …) which run outside the
 *    Next runtime and so can't call revalidate* themselves → authenticated by
 *    a bearer secret (REVALIDATE_SECRET, falling back to AUTH_SECRET so no new
 *    env var is required).
 *
 * An empty POST refreshes the default public set; a body may override it.
 */
const DEFAULT_PATHS = ['/', '/events']
const DEFAULT_TAGS = ['nav-events']

/**
 * Next 16's `revalidateTag(tag, profile)` needs the cache-life profile the tag
 * was created with (see the `cacheLife(...)` calls in `src/lib/nav-data.ts`).
 * Unknown tags fall back to the shortest profile we use.
 */
const TAG_PROFILES: Record<string, string> = {
  'nav-events': 'fiveMinutes',
  companies: 'fiveMinutes',
  'filter-options': 'fiveMinutes',
  videos: 'fiveMinutes',
  photos: 'fifteenMinutes',
  'photo-filters': 'fifteenMinutes',
}
const DEFAULT_PROFILE = 'fiveMinutes'

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : []
}

function secretMatches(token: string): boolean {
  const secret = process.env.REVALIDATE_SECRET || process.env.AUTH_SECRET
  if (!secret || !token) return false
  const a = Buffer.from(token)
  const b = Buffer.from(secret)
  // timingSafeEqual throws on length mismatch — guard first.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  // Admin session (the in-app button).
  const session = await auth()
  if (session?.user?.isAdmin) return true

  // Bearer secret (CLI scripts).
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  return secretMatches(token)
}

async function handleRevalidate(request: NextRequest): Promise<NextResponse> {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Body is optional — an empty POST refreshes the default public set.
  let body: { paths?: unknown; tags?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    // No/invalid JSON body — fall back to defaults.
  }

  const paths = toStringArray(body.paths)
  const tags = toStringArray(body.tags)

  const pathsToRevalidate = paths.length > 0 ? paths : DEFAULT_PATHS
  const tagsToRevalidate = tags.length > 0 ? tags : DEFAULT_TAGS

  for (const path of pathsToRevalidate) {
    revalidatePath(path)
  }
  for (const tag of tagsToRevalidate) {
    revalidateTag(tag, TAG_PROFILES[tag] ?? DEFAULT_PROFILE)
  }

  return NextResponse.json({
    success: true,
    message: 'Public cache refreshed',
    revalidated: { paths: pathsToRevalidate, tags: tagsToRevalidate },
  })
}

// Rate-limited; auth is handled inside (session OR secret) so the endpoint
// can serve both the admin UI and headless CLI callers.
export const POST = withRateLimit(handleRevalidate, 'admin')
