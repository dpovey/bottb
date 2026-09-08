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
      const when = (p.scheduled_for ?? '').slice(0, 16).replace('T', ' ')
      lines.push(`${label}: scheduled ${when}`.trimEnd())
    } else {
      lines.push(`${label}: ${p.status}, no link recorded`)
    }
  }

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
