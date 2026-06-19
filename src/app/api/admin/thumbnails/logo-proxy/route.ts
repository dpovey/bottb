import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Same-origin proxy for company logos so they can be drawn onto a <canvas>
 * without tainting it. Company `logo_url`s are arbitrary external URLs that may
 * not send CORS headers; fetching them server-side and re-serving from our own
 * origin sidesteps that entirely.
 *
 * Admin-only, and restricted to public http(s) hosts to avoid SSRF.
 */

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local')) return true
  // IPv4 private / loopback / link-local ranges.
  return /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
    host
  )
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.isAdmin) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const raw = req.nextUrl.searchParams.get('url')
  if (!raw) {
    return new NextResponse('Missing url parameter', { status: 400 })
  }

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return new NextResponse('Invalid url', { status: 400 })
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return new NextResponse('Unsupported protocol', { status: 400 })
  }
  if (isBlockedHost(target.hostname)) {
    return new NextResponse('Host not allowed', { status: 403 })
  }

  let upstream: Response
  try {
    upstream = await fetch(target.toString(), {
      headers: { 'User-Agent': 'bottb-thumbnail-generator' },
      redirect: 'follow',
    })
  } catch {
    return new NextResponse('Failed to fetch logo', { status: 502 })
  }

  if (!upstream.ok) {
    return new NextResponse('Logo fetch failed', { status: 502 })
  }

  const contentType = upstream.headers.get('content-type') || 'image/png'
  if (!contentType.startsWith('image/')) {
    return new NextResponse('Not an image', { status: 415 })
  }

  const body = await upstream.arrayBuffer()
  return new NextResponse(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
