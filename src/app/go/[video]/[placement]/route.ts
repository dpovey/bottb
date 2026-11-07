import { after, NextRequest, NextResponse } from 'next/server'

/**
 * Tracked link from a social post to a full song on YouTube, for example
 * /go/AT4kyKuBRlQ/li-post. It counts the click in PostHog, then redirects.
 *
 * Only ever redirects to youtu.be, and only for the placements listed here, so
 * it can't be used as an open redirect.
 *
 * Link-preview bots follow these links too. They get the redirect, so the post
 * still shows YouTube's card, but they aren't counted. Counts are an upper bound,
 * because a scanner posing as a browser can't be told apart. The visitor's IP
 * isn't sent to PostHog and no person profile is made.
 */
const PLACEMENTS = new Set(['li-post', 'li-comment', 'fb-caption'])
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const BROWSER = /^Mozilla\/5\.0/
const NOT_A_PERSON =
  /bot|crawl|spider|facebookexternalhit|meta-|whatsapp|preview|headless|embedly|iframely|cardyb|perplexity|googleother/i
const PREFETCH = /prefetch|preview/i
const POSTHOG_CAPTURE = 'https://us.i.posthog.com/capture/'

type Params = { params: Promise<{ video: string; placement: string }> }

async function target({ params }: Params) {
  const { video, placement } = await params
  if (!VIDEO_ID.test(video) || !PLACEMENTS.has(placement)) return null
  return { video, placement }
}

function redirectTo(video: string) {
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: `https://youtu.be/${video}`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  })
}

function isPersonClicking(request: NextRequest) {
  const purpose = ['sec-purpose', 'purpose', 'x-purpose', 'x-moz']
    .map((header) => request.headers.get(header) ?? '')
    .join(' ')
  if (PREFETCH.test(purpose)) return false
  const userAgent = request.headers.get('user-agent') ?? ''
  return BROWSER.test(userAgent) && !NOT_A_PERSON.test(userAgent)
}

async function countClick(video: string, placement: string) {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!apiKey) return
  try {
    const environment = process.env.VERCEL_ENV ?? 'local'
    const response = await fetch(POSTHOG_CAPTURE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
      body: JSON.stringify({
        api_key: apiKey,
        event: 'reel:link_clicked',
        distinct_id: crypto.randomUUID(),
        properties: {
          video,
          placement,
          environment,
          is_production: String(environment === 'production'),
          is_development: String(environment === 'local'),
          $process_person_profile: false,
          $geoip_disable: true,
        },
      }),
    })
    if (!response.ok) {
      console.error('reel:link_clicked not recorded', response.status)
    }
  } catch (error) {
    // A lost count must never break the link.
    console.error('reel:link_clicked not recorded', error)
  }
}

export async function GET(request: NextRequest, context: Params) {
  const link = await target(context)
  if (!link) return new NextResponse(null, { status: 404 })
  if (isPersonClicking(request)) {
    after(() => countClick(link.video, link.placement))
  }
  return redirectTo(link.video)
}

export async function HEAD(_request: NextRequest, context: Params) {
  const link = await target(context)
  if (!link) return new NextResponse(null, { status: 404 })
  return redirectTo(link.video)
}
