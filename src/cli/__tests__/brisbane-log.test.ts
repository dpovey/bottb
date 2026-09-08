import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  interpretBrisbaneLog,
  externalIdFromUrl,
} from '../backfill/brisbane-log'

// The real log is the fixture. A synthetic one would only test the
// interpreter against my own assumptions about the shapes in it.
const LOG_PATH = resolve(
  process.cwd(),
  'doc/production/brisbane-2026-reel-schedule-log.jsonl'
)
const log = readFileSync(LOG_PATH, 'utf8')
const result = interpretBrisbaneLog(log)

const find = (group: string, platform: string) =>
  result.posts.find((p) => p.group_key === group && p.platform === platform)

const all = (group: string, platform: string) =>
  result.posts.filter((p) => p.group_key === group && p.platform === platform)

describe('externalIdFromUrl', () => {
  it('reads facebook reel, video and page-post ids', () => {
    expect(
      externalIdFromUrl(
        'facebook',
        'https://www.facebook.com/reel/2138258163708684'
      )
    ).toBe('2138258163708684')
    expect(
      externalIdFromUrl(
        'facebook',
        'https://www.facebook.com/207312765803305/videos/1417367267196479'
      )
    ).toBe('1417367267196479')
    expect(
      externalIdFromUrl(
        'facebook',
        'https://www.facebook.com/122279449718181400/posts/122281772582181400'
      )
    ).toBe('122281772582181400')
  })

  it('reads instagram shortcodes from both /reel/ and /p/', () => {
    expect(
      externalIdFromUrl(
        'instagram',
        'https://www.instagram.com/reel/DcqJutegoHU/'
      )
    ).toBe('DcqJutegoHU')
    expect(
      externalIdFromUrl('instagram', 'https://www.instagram.com/p/DdAmYtaH4Da/')
    ).toBe('DdAmYtaH4Da')
  })

  it('keeps the whole urn for linkedin, since that is the id', () => {
    expect(
      externalIdFromUrl(
        'linkedin',
        'https://www.linkedin.com/feed/update/urn:li:ugcPost:7502914216421593089/'
      )
    ).toBe('urn:li:ugcPost:7502914216421593089')
  })

  it('reads youtube ids from shorts and youtu.be', () => {
    expect(
      externalIdFromUrl('youtube', 'https://youtube.com/shorts/ybYOCrGhNVY')
    ).toBe('ybYOCrGhNVY')
    expect(externalIdFromUrl('youtube', 'https://youtu.be/wM7hSnZJn0A')).toBe(
      'wM7hSnZJn0A'
    )
  })
})

describe('interpretBrisbaneLog', () => {
  it('understands every line of the real log', () => {
    expect(result.unhandled).toEqual([])
  })

  it('is deterministic', () => {
    expect(interpretBrisbaneLog(log)).toEqual(result)
  })

  it('names every published post whose time it could not recover', () => {
    // A published post with no time is allowed - the ShipReX full video is
    // exactly that - but it must never pass silently.
    const timeless = result.posts.filter(
      (p) => p.status === 'published' && !p.posted_at
    )
    for (const p of timeless) {
      expect(
        result.unrecoverable.some(
          (u) => u.includes(p.group_key) && u.includes(p.platform)
        ),
        `${p.group_key}/${p.platform} has no time and no explanation`
      ).toBe(true)
      expect(p.posted_at_estimated).toBe(false)
    }
  })

  it('gives every post a group and a platform', () => {
    for (const p of result.posts) {
      expect(p.group_key).toBeTruthy()
      expect(p.platform).toBeTruthy()
      expect(p.event_id).toBe('brisbane-2026')
      expect(p.posted_tz).toBe('Australia/Brisbane')
    }
  })

  it('never emits two posts with the same platform and external id', () => {
    const seen = new Set<string>()
    for (const p of result.posts) {
      if (!p.external_id) continue
      const k = `${p.platform}|${p.external_id}`
      expect(seen.has(k), `duplicate ${k}`).toBe(false)
      seen.add(k)
    }
  })

  it('covers all six reels on all five platforms', () => {
    const groups = [
      'brisbane-2026-reel-night-highlights',
      'brisbane-2026-reel-shiprex',
      'brisbane-2026-reel-epsonics',
      'brisbane-2026-reel-jumbo-band',
      'brisbane-2026-reel-total-loss',
      'brisbane-2026-reel-off-the-record',
    ]
    for (const g of groups) {
      for (const platform of [
        'facebook',
        'instagram',
        'linkedin',
        'tiktok',
        'youtube',
      ]) {
        expect(find(g, platform), `${g}/${platform}`).toBeDefined()
      }
    }
  })
})

describe('the three wrong TikTok ids', () => {
  // Lines 17, 21 and 18 recorded a TikTok id that belonged to another post.
  // Line 27 re-derived all of them from each video's own oEmbed caption.
  it('uses the verified id for the night highlights reel, not line 17s', () => {
    const p = find('brisbane-2026-reel-night-highlights', 'tiktok')
    expect(p?.external_id).toBe('7679756501841448212')
    expect(p?.external_id).not.toBe('7679788237623151892')
  })

  it('uses the verified id for the ShipReX reel, not line 21s', () => {
    const p = find('brisbane-2026-reel-shiprex', 'tiktok')
    expect(p?.external_id).toBe('7679758557033532692')
    expect(p?.external_id).not.toBe('7680120593496231189')
  })

  it('uses the verified id for the full ShipReX video, not line 18s', () => {
    const p = find('brisbane-2026-fullvideo-shiprex', 'tiktok')
    expect(p?.external_id).toBe('7680120593496231189')
    expect(p?.external_id).not.toBe('7679791125216890132')
  })

  it('says out loud that it overrode them', () => {
    const tiktokCorrections = result.superseded.filter((s) =>
      s.includes("another post's")
    )
    expect(tiktokCorrections.length).toBe(3)
  })

  it('leaves the ids that were already right alone', () => {
    expect(find('brisbane-2026-reel-epsonics', 'tiktok')?.external_id).toBe(
      '7679777563908001045'
    )
    expect(find('brisbane-2026-reel-jumbo-band', 'tiktok')?.external_id).toBe(
      '7679784601279106324'
    )
    expect(
      find('brisbane-2026-reel-off-the-record', 'tiktok')?.external_id
    ).toBe('7679791125216890132')
  })
})

describe('the two missing LinkedIn permalinks', () => {
  it('records them as unrecoverable rather than inventing a link', () => {
    const nh = find('brisbane-2026-reel-night-highlights', 'linkedin')
    const tl = find('brisbane-2026-reel-total-loss', 'linkedin')
    expect(nh?.permalink).toBeNull()
    expect(tl?.permalink).toBeNull()
    expect(nh?.external_id).toBeNull()
    expect(tl?.external_id).toBeNull()
  })

  it('names them in the unrecoverable list', () => {
    const linkedin = result.unrecoverable.filter(
      (u) => u.includes('linkedin') && u.includes('no permalink was ever')
    )
    expect(linkedin.length).toBe(2)
    expect(linkedin.join('\n')).toContain('night-highlights')
    expect(linkedin.join('\n')).toContain('total-loss')
  })

  it('still records the four LinkedIn reel posts that do have links', () => {
    for (const g of [
      'brisbane-2026-reel-shiprex',
      'brisbane-2026-reel-epsonics',
      'brisbane-2026-reel-jumbo-band',
      'brisbane-2026-reel-off-the-record',
    ]) {
      expect(find(g, 'linkedin')?.permalink).toMatch(/linkedin\.com/)
    }
  })
})

describe('estimated versus measured times', () => {
  it('marks Instagram reel publish times as estimates', () => {
    const p = find('brisbane-2026-reel-shiprex', 'instagram')
    expect(p?.posted_at_estimated).toBe(true)
  })

  it('applies the 12:19 correction to the Epsonics photo post', () => {
    const fb = find('brisbane-2026-photos-epsonics', 'facebook')
    expect(fb?.posted_at).toBe('2026-09-08T12:19:34+10:00')
    expect(fb?.posted_at_estimated).toBe(false)
  })

  it('applies the LinkedIn snowflake time and keeps it measured', () => {
    const li = find('brisbane-2026-photos-epsonics', 'linkedin')
    expect(li?.posted_at).toBe('2026-09-08T12:22:26+10:00')
    expect(li?.posted_at_estimated).toBe(false)
  })

  it('leaves the platforms with no read-back marked as estimates', () => {
    for (const platform of ['instagram', 'tiktok']) {
      const p = find('brisbane-2026-photos-epsonics', platform)
      expect(p?.posted_at).toBe('2026-09-08T12:20:00+10:00')
      expect(p?.posted_at_estimated).toBe(true)
    }
  })

  it('never leaves the wrong 10:20 time anywhere', () => {
    for (const p of result.posts) {
      expect(p.posted_at ?? '').not.toContain('T10:20')
    }
  })
})

describe('withdrawals and deletions', () => {
  it('withdraws the flickery YouTube upload and its Facebook schedule', () => {
    const yt = all('brisbane-2026-thechain', 'youtube').find(
      (p) => p.external_id === '_g-3R04bYF8'
    )
    expect(yt?.status).toBe('withdrawn')
    // It never went public, so it has a due time, not a posting time.
    expect(yt?.posted_at).toBeNull()
    expect(yt?.scheduled_for).toBe('2026-09-07T17:00:00+10:00')
    const fb = all('brisbane-2026-thechain', 'facebook').find(
      (p) => p.external_id === '1589456326190406'
    )
    expect(fb?.status).toBe('withdrawn')
  })

  it('keeps the replacement The Chain posts published', () => {
    const yt = all('brisbane-2026-thechain', 'youtube').find(
      (p) => p.external_id === 'wM7hSnZJn0A'
    )
    expect(yt?.status).toBe('published')
    const fb = all('brisbane-2026-thechain', 'facebook').find(
      (p) => p.external_id === '1390029213265321'
    )
    expect(fb?.status).toBe('published')
    expect(fb?.posted_at).toBe('2026-09-07T18:00:00+10:00')
    expect(fb?.posted_at_estimated).toBe(false)
    const ig = find('brisbane-2026-thechain', 'instagram')
    expect(ig?.posted_at).toBe('2026-09-07T18:00:19+10:00')
    expect(ig?.posted_at_estimated).toBe(false)
  })

  it('keeps the first estimate rather than a later entry writing about it', () => {
    // LinkedIn and TikTok went out around 16:10 (line 39). The
    // ALL_PLATFORMS_LIVE entry at 18:00 only repeats their links.
    const li = find('brisbane-2026-thechain', 'linkedin')
    expect(li?.posted_at?.slice(0, 16)).toBe('2026-09-07T16:10')
    expect(li?.posted_at_estimated).toBe(true)
  })

  it('marks the deleted stale Facebook post as deleted', () => {
    const fb = all('brisbane-2026-thechain', 'facebook').find(
      (p) => p.external_id === '122281575932181400'
    )
    expect(fb?.status).toBe('deleted')
  })

  it('marks the replaced ShipReX Instagram repost as deleted', () => {
    const igs = all('brisbane-2026-fullvideo-shiprex', 'instagram')
    expect(igs.length).toBe(2)
    expect(igs.find((p) => p.external_id === 'Dcsp2iXjqGR')?.status).toBe(
      'deleted'
    )
    expect(igs.find((p) => p.external_id === 'DcsrZgMiVkN')?.status).toBe(
      'published'
    )
  })
})

describe('the natively scheduled Facebook photo posts', () => {
  it('records all four as scheduled, with their times', () => {
    const expected: [string, string][] = [
      ['brisbane-2026-photos-jumbo-band', '2026-09-09T09:00:00+10:00'],
      ['brisbane-2026-photos-total-loss', '2026-09-10T09:00:00+10:00'],
      ['brisbane-2026-photos-off-the-record', '2026-09-11T09:00:00+10:00'],
      ['brisbane-2026-photos-audience', '2026-09-12T09:00:00+10:00'],
    ]
    for (const [group, when] of expected) {
      const p = find(group, 'facebook')
      expect(p?.status).toBe('scheduled')
      expect(p?.scheduled_for).toBe(when)
      expect(p?.posted_via).toBe('native_schedule')
    }
  })

  it('warns that their Instagram, LinkedIn and TikTok halves are unrecorded', () => {
    expect(result.warnings.join('\n')).toMatch(
      /Instagram has no scheduling API/
    )
  })
})

describe('collaborators and media', () => {
  it('keeps the Instagram collaborators from the build entries', () => {
    expect(
      find('brisbane-2026-reel-shiprex', 'instagram')?.collaborators
    ).toEqual(['rex_software', 'urbanx.io', 'thetriffid'])
  })

  it('keeps the blob url the post was built from', () => {
    expect(find('brisbane-2026-reel-shiprex', 'facebook')?.media_url).toContain(
      'TSR_CIC_branded.mp4'
    )
  })

  it('uses the band id the database actually holds', () => {
    // "The ShipReX" was renamed after its band row was created, and band ids
    // are frozen at creation. Deriving this one from the display name gives
    // shiprex-brisbane-2026, which does not exist and fails the foreign key.
    expect(find('brisbane-2026-reel-shiprex', 'facebook')?.band_id).toBe(
      'the-shiprex-brisbane-2026'
    )
  })

  it('attaches the band to every reel post that has one', () => {
    for (const p of all('brisbane-2026-reel-epsonics', 'instagram')) {
      expect(p.band_id).toBe('epsonics-brisbane-2026')
    }
    expect(
      find('brisbane-2026-reel-night-highlights', 'facebook')?.band_id
    ).toBeNull()
  })
})
