import { describe, it, expect } from 'vitest'
import {
  buildTrackedUrl,
  defaultMediumFor,
  deriveUtms,
  trackedUrlForPost,
} from '../utm'

describe('defaultMediumFor', () => {
  it('sends Instagram through the bio link, because captions are not clickable', () => {
    expect(defaultMediumFor('instagram')).toBe('social_bio')
  })

  it('uses plain social everywhere the caption itself is a link', () => {
    for (const p of ['facebook', 'linkedin', 'tiktok', 'youtube'] as const) {
      expect(defaultMediumFor(p)).toBe('social')
    }
  })
})

describe('deriveUtms', () => {
  it('uses the event slug as the campaign so it joins to events.id', () => {
    const utms = deriveUtms({
      platform: 'facebook',
      event_id: 'brisbane-2026',
      group_key: 'brisbane-2026-reel-shiprex',
    })
    expect(utms.utm_campaign).toBe('brisbane-2026')
    expect(utms.utm_source).toBe('facebook')
    expect(utms.utm_content).toBe('brisbane-2026-reel-shiprex-facebook')
  })

  it('gives each platform in a burst its own content bucket', () => {
    const group = 'brisbane-2026-reel-shiprex'
    const a = deriveUtms({
      platform: 'facebook',
      event_id: 'x',
      group_key: group,
    })
    const b = deriveUtms({
      platform: 'tiktok',
      event_id: 'x',
      group_key: group,
    })
    expect(a.utm_content).not.toBe(b.utm_content)
  })

  it('leaves content null rather than guessing when there is no group', () => {
    expect(
      deriveUtms({ platform: 'facebook', event_id: 'x', group_key: null })
        .utm_content
    ).toBeNull()
  })

  it('never overwrites a value the post already carries', () => {
    const utms = deriveUtms({
      platform: 'facebook',
      event_id: 'brisbane-2026',
      group_key: 'g',
      utm_medium: 'social_story',
      utm_content: 'hand-picked',
    })
    expect(utms.utm_medium).toBe('social_story')
    expect(utms.utm_content).toBe('hand-picked')
  })
})

describe('buildTrackedUrl', () => {
  it('tags the site root', () => {
    const url = buildTrackedUrl('https://battleofthetechbands.com', {
      utm_campaign: 'brisbane-2026',
      utm_source: 'instagram',
      utm_medium: 'social_bio',
      utm_content: 'brisbane-2026-reel-shiprex-instagram',
    })
    expect(url).toBe(
      'https://battleofthetechbands.com/?utm_campaign=brisbane-2026&utm_source=instagram&utm_medium=social_bio&utm_content=brisbane-2026-reel-shiprex-instagram'
    )
  })

  it('keeps an existing path and query', () => {
    const url = buildTrackedUrl(
      'https://battleofthetechbands.com/events/brisbane-2026?tab=photos',
      { utm_campaign: 'brisbane-2026' }
    )
    expect(url).toContain('/events/brisbane-2026')
    expect(url).toContain('tab=photos')
    expect(url).toContain('utm_campaign=brisbane-2026')
  })

  it('omits empty parameters rather than emitting utm_content= with nothing', () => {
    const url = buildTrackedUrl('https://battleofthetechbands.com', {
      utm_campaign: 'brisbane-2026',
      utm_content: null,
    })
    expect(url).not.toContain('utm_content')
  })

  it('accepts a relative target', () => {
    expect(buildTrackedUrl('/shop', { utm_source: 'tiktok' })).toBe(
      'https://battleofthetechbands.com/shop?utm_source=tiktok'
    )
  })
})

describe('trackedUrlForPost', () => {
  it('builds a caption-ready link from a post row', () => {
    expect(
      trackedUrlForPost({
        platform: 'instagram',
        event_id: 'brisbane-2026',
        group_key: 'brisbane-2026-photos-epsonics',
      })
    ).toBe(
      'https://battleofthetechbands.com/?utm_campaign=brisbane-2026&utm_source=instagram&utm_medium=social_bio&utm_content=brisbane-2026-photos-epsonics-instagram'
    )
  })
})
