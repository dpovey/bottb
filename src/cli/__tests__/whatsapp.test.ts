import { describe, it, expect } from 'vitest'
import { whatsappText } from '../whatsapp'
import type { Post } from '../../lib/db-types'

function post(p: Partial<Post>): Post {
  return {
    id: 'id',
    group_key: 'brisbane-2026-reel-shiprex',
    platform: 'facebook',
    external_id: null,
    permalink: null,
    status: 'published',
    content_type: 'reel',
    event_id: 'brisbane-2026',
    band_id: null,
    video_id: null,
    photo_ids: null,
    title: 'ShipReX',
    caption: null,
    collaborators: null,
    mentions: null,
    media_url: null,
    scheduled_for: null,
    posted_at: null,
    posted_at_estimated: false,
    posted_tz: 'Australia/Brisbane',
    posted_via: null,
    permalink_verified_at: null,
    utm_campaign: null,
    utm_source: null,
    utm_medium: null,
    utm_content: null,
    source: null,
    metadata: {},
    notes: null,
    created_at: '',
    updated_at: '',
    ...p,
  }
}

const sample = [
  post({
    platform: 'youtube',
    permalink: 'https://youtube.com/shorts/6iruDMHMxH4',
  }),
  post({
    platform: 'linkedin',
    permalink:
      'https://www.linkedin.com/feed/update/urn:li:activity:7500439978888409089',
  }),
  post({
    platform: 'facebook',
    permalink: 'https://www.facebook.com/reel/1122911013395583',
  }),
]

describe('whatsappText', () => {
  it('is plain text that WhatsApp will not mangle', () => {
    const text = whatsappText(sample)
    expect(text).not.toMatch(/```/)
    expect(text).not.toMatch(/^>/m)
    expect(text).not.toMatch(/^[*-] /m)
    expect(text).not.toMatch(/\[.*\]\(.*\)/)
    expect(text).not.toMatch(/^#/m)
  })

  it('puts one link on its own line so each becomes a preview', () => {
    const lines = whatsappText(sample).split('\n')
    const linkLines = lines.filter((l) => l.includes('http'))
    expect(linkLines).toHaveLength(3)
    for (const l of linkLines) {
      expect(l.match(/http/g)).toHaveLength(1)
    }
  })

  it('leads with the title', () => {
    expect(whatsappText(sample).split('\n')[0]).toBe('ShipReX')
  })

  it('uses the names people use, not the enum values', () => {
    const text = whatsappText(sample)
    expect(text).toContain('YouTube:')
    expect(text).toContain('LinkedIn:')
    expect(text).not.toContain('linkedin:')
  })

  it('says a link is missing rather than quietly dropping the platform', () => {
    const text = whatsappText([
      ...sample,
      post({ platform: 'tiktok', permalink: null, status: 'published' }),
    ])
    expect(text).toContain('TikTok: published, no link recorded')
    expect(text).toContain('Note: no link was recorded for TikTok.')
  })

  it('shows a scheduled post as scheduled, with its time', () => {
    const text = whatsappText([
      post({
        platform: 'instagram',
        status: 'scheduled',
        scheduled_for: '2026-09-09T09:00:00+10:00',
      }),
    ])
    expect(text).toContain('Instagram: scheduled 2026-09-09 09:00')
  })

  it('says so plainly when there is nothing', () => {
    expect(whatsappText([])).toBe('Nothing recorded for that group yet.')
  })
})
