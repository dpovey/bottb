import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, HEAD } from '../route'

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => unknown) => task(),
}))

const VIDEO = 'AT4kyKuBRlQ'
const PHONE = 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 LinkedInApp'

function context(video = VIDEO, placement = 'li-post') {
  return { params: Promise.resolve({ video, placement }) }
}
function request(headers: Record<string, string> = { 'user-agent': PHONE }) {
  return new NextRequest(`https://example.com/go/${VIDEO}/li-post`, { headers })
}

describe('/go/[video]/[placement]', () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}'))

  beforeEach(() => {
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('redirects to the video and counts a person', async () => {
    const res = await GET(request(), context())
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(`https://youtu.be/${VIDEO}`)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.event).toBe('reel:link_clicked')
    expect(body.properties).toMatchObject({
      video: VIDEO,
      placement: 'li-post',
      is_production: 'false',
      is_development: 'true',
      $process_person_profile: false,
      $geoip_disable: true,
    })
  })

  it.each([
    ['LinkedInBot/1.0'],
    ['facebookexternalhit/1.1'],
    ['WhatsApp/2.23'],
    ['Googlebot/2.1'],
    ['curl/8.7.1'],
    ['python-requests/2.32'],
    ['Mozilla/5.0 HeadlessChrome/120.0'],
    ['Mozilla/5.0 (compatible; meta-externalagent/1.1)'],
  ])('redirects but does not count %s', async (ua) => {
    const res = await GET(request({ 'user-agent': ua }), context())
    expect(res.status).toBe(302)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not count a request with no user agent', async () => {
    const res = await GET(request({}), context())
    expect(res.status).toBe(302)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['sec-purpose', 'prefetch'],
    ['purpose', 'prefetch'],
    ['x-purpose', 'preview'],
    ['x-moz', 'prefetch'],
  ])('does not count a fetch with %s: %s', async (header, value) => {
    await GET(request({ 'user-agent': PHONE, [header]: value }), context())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/500.0]'],
    ['Mozilla/5.0 (Linux; Android 15; wv) Chrome/130.0 Mobile [FB_IAB/FB4A]'],
    ['Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Instagram 350.0'],
    ['Mozilla/5.0 (Linux; Android 15) Chrome/130.0 Mobile GSA/15.0'],
  ])('counts the in-app browser %s', async (ua) => {
    await GET(request({ 'user-agent': ua }), context())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('redirects on HEAD without counting', async () => {
    const res = await HEAD(request(), context())
    expect(res.status).toBe(302)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['too-short', 'li-post'],
    ['https:evil.', 'li-post'],
    [VIDEO, 'unknown'],
  ])('returns 404 for %s / %s', async (video, placement) => {
    const res = await GET(request(), context(video, placement))
    expect(res.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('logs when PostHog refuses the event', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429 }))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET(request(), context())
    expect(res.status).toBe(302)
    await vi.waitFor(() => expect(error).toHaveBeenCalled())
    error.mockRestore()
  })

  it('still redirects when the count fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('down'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET(request(), context())
    expect(res.status).toBe(302)
    await vi.waitFor(() => expect(error).toHaveBeenCalled())
    error.mockRestore()
  })
})
