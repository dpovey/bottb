import type { Post } from '../lib/db-types'

/**
 * WhatsApp is where these summaries actually get shared, and they are pasted
 * straight in. So: plain text, one link per line, no markdown, no blockquotes,
 * no code fences. WhatsApp renders none of that - it lands as literal
 * backticks and angle brackets in the message.
 *
 * A missing link is stated, not skipped. The whole reason for this ledger is
 * that "we posted it somewhere and lost the link" happened six times in one
 * week.
 */

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  threads: 'Threads',
}

const SITE = 'https://battleofthetechbands.com'

/**
 * The slot as people read it, to the minute. The Postgres driver hands back
 * timestamptz as a Date (db-types says string), which crashed `.slice` here;
 * a Date is shown in the post's own zone, a string keeps its own offset.
 */
function localMinute(value: unknown, tz: string | null): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: tz ?? 'Australia/Brisbane',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(value)
  }
  return typeof value === 'string' ? value.slice(0, 16).replace('T', ' ') : ''
}

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform
}

export function whatsappText(posts: Post[]): string {
  if (posts.length === 0) return 'Nothing recorded for that group yet.'

  const lines: string[] = []
  lines.push(posts[0].title ?? posts[0].group_key ?? 'Posts')

  for (const p of posts) {
    const label = platformLabel(p.platform)
    if (p.permalink) {
      lines.push(`${label}: ${p.permalink}`)
    } else if (p.status === 'scheduled') {
      const when = localMinute(p.scheduled_for, p.posted_tz)
      lines.push(`${label}: scheduled ${when}`.trimEnd())
    } else {
      lines.push(`${label}: ${p.status}, no link recorded`)
    }
  }

  // The band's page on the site, which holds the YouTube video once it is inserted.
  const band = posts.find((p) => p.band_id)?.band_id
  if (band) lines.push(`Site: ${SITE}/band/${band}`)

  const missing = posts.filter((p) => p.status === 'published' && !p.permalink)
  if (missing.length > 0) {
    lines.push('')
    lines.push(
      `Note: no link was recorded for ${missing
        .map((p) => platformLabel(p.platform))
        .join(', ')}.`
    )
  }

  return lines.join('\n')
}
