import { describe, expect, it } from 'vitest'

import {
  matchPost,
  toEventRef,
  type BandRef,
  type CompanyRef,
} from '../harvest/match'
import { extractMentions, planFacebook } from '../harvest/plan'
import type { FbPost, FbVideo } from '../harvest/fetch'

// The real event and band rows, abbreviated. Band ids are deliberately the
// frozen ones - `the-shiprex-brisbane-2026` for a band now called "ShipReX" -
// because that mismatch is exactly what the matcher has to survive.
const events = [
  { id: 'brisbane-2022', date: '2022-08-17T08:30:00.000Z' },
  { id: 'brisbane-2023', date: '2023-08-24T08:30:00.000Z' },
  { id: 'brisbane-2024', date: '2024-09-05T08:30:00.000Z' },
  { id: 'brisbane-2025', date: '2025-09-04T08:30:00.000Z' },
  { id: 'sydney-2025', date: '2025-10-23T07:30:00.000Z' },
  { id: 'melbourne-2026', date: '2026-06-05T08:30:00.000Z' },
  { id: 'brisbane-2026', date: '2026-08-27T08:30:00.000Z' },
  { id: 'sydney-2026', date: '2026-10-08T07:30:00.000Z' },
].map(toEventRef)

const bands: BandRef[] = [
  {
    id: 'the-shiprex-brisbane-2022',
    name: 'The ShipRex',
    event_id: 'brisbane-2022',
    company_slug: 'rex-software',
  },
  {
    id: 'soundu-brisbane-2023',
    name: 'SoundU',
    event_id: 'brisbane-2023',
    company_slug: 'foundu',
  },
  {
    id: 'the-shiprex-brisbane-2025',
    name: 'The ShipRex',
    event_id: 'brisbane-2025',
    company_slug: 'rex-software',
  },
  {
    id: 'epsonics-brisbane-2025',
    name: 'Epsonics',
    event_id: 'brisbane-2025',
    company_slug: 'epsilon',
  },
  {
    id: 'the-agentics-sydney-2025',
    name: 'The Agentics',
    event_id: 'sydney-2025',
    company_slug: 'salesforce',
  },
  {
    id: 'loop-there-it-is-melbourne-2026',
    name: 'Loop There It Is',
    event_id: 'melbourne-2026',
    company_slug: 'mentorloop',
  },
  {
    id: 'the-shiprex-brisbane-2026',
    name: 'ShipReX',
    event_id: 'brisbane-2026',
    company_slug: 'rex-software',
  },
  {
    id: 'epsonics-brisbane-2026',
    name: 'Epsonics',
    event_id: 'brisbane-2026',
    company_slug: 'epsilon',
  },
  {
    id: 'total-loss-brisbane-2026',
    name: 'Total Loss',
    event_id: 'brisbane-2026',
    company_slug: 'suncorp',
  },
  {
    id: 'jumbo-band-brisbane-2026',
    name: 'Jumbo Band',
    event_id: 'brisbane-2026',
    company_slug: 'jumbo-interactive',
  },
  {
    id: 'shiprex-sydney-2026',
    name: 'ShipReX',
    event_id: 'sydney-2026',
    company_slug: 'rex-software',
  },
]

const companies: CompanyRef[] = [
  { slug: 'rex-software', name: 'Rex Software' },
  { slug: 'jumbo-interactive', name: 'Jumbo Interactive' },
  { slug: 'suncorp', name: 'Suncorp' },
  { slug: 'salesforce', name: 'Salesforce' },
  { slug: 'mentorloop', name: 'Mentorloop' },
]

const match = (text: string, postedAt: string) =>
  matchPost({ text, postedAt }, events, bands, companies)

describe('matchPost', () => {
  it('files a wrap-up under the event it is about, not the one it trails', () => {
    // The real Brisbane 2026 champions post. It names Sydney, four Sydney
    // 2026 companies and a Sydney date in its last paragraph.
    const caption = `🏆 The ShipReX are your Battle of the Tech Bands Brisbane 2026 champions!!!

Rex Software + URBAN X got up there and absolutely shipped it.

What a night. Five bands, a full room at The Triffid.

Next stop: Sydney. 8 October at The Manning Bar, with Amazon, Atlassian, Canva and V2 AI already locked in.`
    const r = match(caption, '2026-08-29T00:08:55+0000')
    expect(r.eventId).toBe('brisbane-2026')
    expect(r.bandId).toBe('the-shiprex-brisbane-2026')
    expect(r.eventConfidence).toBe('high')
  })

  it('resolves a renamed band to its frozen id', () => {
    const r = match(
      'ShipReX are the biggest band on this years Brisbane bill. Tickets: https://bottb.com/event/brisbane-2026',
      '2026-08-20T07:56:36+0000'
    )
    expect(r.bandId).toBe('the-shiprex-brisbane-2026')
  })

  it('matches a band name whose punctuation differs from the row', () => {
    // The row says "Loop There It Is"; every caption writes "Loop, There it is".
    const r = match(
      'Closing out the 2026 Melbourne Battle of the Tech Bands, Loop, There It Is from Mentorloop brought the mentoring framework we all deserved.',
      '2026-06-18T22:00:09+0000'
    )
    expect(r.eventId).toBe('melbourne-2026')
    expect(r.bandId).toBe('loop-there-it-is-melbourne-2026')
  })

  it('treats a year named years later as history, not subject matter', () => {
    // Posted two days before Brisbane 2025, opening on a 2022 reference.
    const r = match(
      '🚢🎶 From the very first Battle of the Tech Bands in 2022, The ShipRex from @rex_software have been part of the journey. Catch The ShipRex live this Thursday night at @thetriffid.',
      '2025-09-02T21:03:25+0000'
    )
    expect(r.eventId).toBe('brisbane-2025')
    expect(r.bandId).toBe('the-shiprex-brisbane-2025')
  })

  it('uses a bare year when that year had exactly one event', () => {
    const r = match(
      "We kicking off the highlight tour with last year's winners foundU and their aptly named band SoundU! #battleofthetechbands #bottb23",
      '2024-02-01T04:58:59+0000'
    )
    expect(r.eventId).toBe('brisbane-2023')
    expect(r.bandId).toBe('soundu-brisbane-2023')
  })

  it('leaves a two-city teaser unresolved rather than guessing', () => {
    const r = match(
      'Dare to dream. Be the rockstar. 📌 BRISBANE 04 SEPT – The Triffid 📌 SYDNEY 23 OCT – The Factory Theatre',
      '2025-05-25T08:00:32+0000'
    )
    // Both cities named with no year attached to either; only the date
    // window separates them, so this must not come back as a confident claim.
    expect(r.eventConfidence).not.toBe('high')
  })

  it('does not read the sponsor line as a band credit', () => {
    const r = match(
      'Highlights from the Sydney Battle of the Tech Bands 2025. Powered by Jumbo Interactive.',
      '2025-10-26T02:29:25+0000'
    )
    expect(r.eventId).toBe('sydney-2025')
    expect(r.bandId).toBeNull()
  })

  it('leaves the band null when a post names several of them', () => {
    const r = match(
      'Congratulations to Total Loss, Epsonics and ShipReX at Brisbane 2026.',
      '2026-08-29T00:00:00+0000'
    )
    expect(r.eventId).toBe('brisbane-2026')
    expect(r.bandId).toBeNull()
    expect(r.reasons.some((x) => x.includes('band left null'))).toBe(true)
  })

  it('returns nothing at all for a post with no signal', () => {
    const r = match('🎸🤘', '2019-01-01T00:00:00+0000')
    expect(r.eventId).toBeNull()
    expect(r.eventConfidence).toBe('none')
  })
})

describe('planFacebook', () => {
  const ctx = { events, bands, companies }

  const post = (over: Partial<FbPost>): FbPost => ({
    id: '207312765803305_1',
    created_time: '2026-09-01T08:00:00+0000',
    status_type: 'added_video',
    ...over,
  })
  const video = (over: Partial<FbVideo>): FbVideo => ({
    id: '999',
    created_time: '2026-09-01T08:00:05+0000',
    ...over,
  })

  it('folds a video into its post rather than emitting both', () => {
    const rows = planFacebook(
      [post({ message: 'Brisbane 2026 champions ShipReX.' })],
      [video({ description: 'Brisbane 2026 champions ShipReX.', views: 412 })],
      ctx
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].metadata.views).toBe(412)
    expect(rows[0].metadata.fb_video_id).toBe('999')
  })

  it('matches an uploaded-days-early video by its caption', () => {
    // A scheduled reel is uploaded long before it publishes, so the two
    // created_times are days apart. Identical text is the real evidence.
    const rows = planFacebook(
      [post({ message: 'Epsonics (Epsilon).' })],
      [
        video({
          created_time: '2026-08-25T02:00:00+0000',
          description: 'Epsonics (Epsilon).',
          views: 88,
        }),
      ],
      ctx
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].metadata.views).toBe(88)
  })

  it('keeps a video with no matching post as its own row', () => {
    const rows = planFacebook(
      [post({ message: 'Something else entirely about Brisbane 2026.' })],
      [video({ description: 'A reel that never hit published_posts.' })],
      ctx
    )
    expect(rows).toHaveLength(2)
    const orphan = rows.find((r) => r.external_id === '999')
    expect(orphan?.source).toBe('harvest:facebook-videos')
  })

  it('never marks a harvested time as estimated', () => {
    const rows = planFacebook([post({ message: 'x' })], [], ctx)
    expect(rows[0].posted_at_estimated).toBe(false)
  })
})

describe('extractMentions', () => {
  it('pulls handles out of a caption', () => {
    expect(
      extractMentions(
        'Thank you @rex_software @urbanx.io @suncorp Epsilon, and @youngcareoz.'
      )
    ).toEqual(['rex_software', 'urbanx.io', 'suncorp', 'youngcareoz'])
  })

  it('returns nothing for an empty caption', () => {
    expect(extractMentions(null)).toEqual([])
  })
})
