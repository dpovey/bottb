#!/usr/bin/env node
// Connect social posts (the `posts` ledger) to website visits and ticket clicks (PostHog).
//
//   node doc/production/scripts/social-site-attribution.mjs [--since 2026-08-20]
//        [--window-hours 48] [--event sydney-2026] [--json]
//
// Read-only: queries PostHog (HogQL) and Postgres (Neon HTTP /sql); writes nothing.
// Run from the repo root (reads .env.local there).
//
// How a site session gets a platform, strongest signal first:
//   1. utm_source on the landing pageview (exact, and utm_content names the post)
//   2. the in-app browser user agent: Instagram, FBAN/FBAV/FB_IAB, LinkedInApp, TikTok.
//      This recovers the Facebook-app visits that arrive with no referrer and would
//      otherwise be counted as direct.
//   3. $referring_domain
// A social session is credited to the most recent post on the same platform published
// within --window-hours before it (last touch by time), unless its utm_content matches a
// post's utm_content, which wins outright. Time-window credit is a correlation, not proof:
// a band member's own share of the event page lands in the same window.
//
// "Ticket session" = a session that fired `tickets:clicked` (left for the ticketing site;
// not a purchase).

import fs from 'node:fs'

const args = process.argv.slice(2)
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : dflt
}
const SINCE = opt('since', '2026-08-20')
const WINDOW_H = Number(opt('window-hours', '48'))
const EVENT = opt('event', null)
const JSON_OUT = args.includes('--json')
if (!/^\d{4}-\d{2}-\d{2}$/.test(SINCE))
  throw new Error(`--since must be YYYY-MM-DD, got ${SINCE}`)

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]
    })
)
for (const k of ['POSTHOG_PERSONAL_API_KEY', 'POSTHOG_ENV_ID', 'POSTGRES_URL'])
  if (!env[k]) throw new Error(`${k} missing from .env.local`)

async function hogql(query) {
  const r = await fetch(
    `https://us.posthog.com/api/projects/${env.POSTHOG_ENV_ID}/query/`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.POSTHOG_PERSONAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    }
  )
  const j = await r.json()
  if (!j.results) throw new Error(`PostHog: ${JSON.stringify(j).slice(0, 500)}`)
  return j.results.map((row) =>
    Object.fromEntries(j.columns.map((c, i) => [c, row[i]]))
  )
}

async function sql(query, params = []) {
  const host = new URL(env.POSTGRES_URL).hostname
  const r = await fetch(`https://${host}/sql`, {
    method: 'POST',
    headers: {
      'Neon-Connection-String': env.POSTGRES_URL,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, params }),
  })
  const j = await r.json()
  if (!j.rows) throw new Error(`Postgres: ${JSON.stringify(j).slice(0, 500)}`)
  return j.rows
}

// ---- site sessions -------------------------------------------------------------------
const LIMIT = 50000
const sessions = await hogql(`
  select $session_id as sid,
         min(timestamp) as start,
         argMin(properties.$pathname, timestamp) as landing,
         argMin(properties.utm_source, timestamp) as utm_source,
         argMin(properties.utm_content, timestamp) as utm_content,
         argMin(properties.$referring_domain, timestamp) as rd,
         argMin(properties.$raw_user_agent, timestamp) as ua,
         countIf(event = '$pageview') as pageviews,
         countIf(event = 'tickets:clicked') as ticket_clicks,
         groupUniqArrayIf(properties.event_id, event = 'tickets:clicked') as ticket_events
  from events
  where timestamp >= toDateTime('${SINCE} 00:00:00', 'Australia/Sydney')
    and event in ('$pageview', 'tickets:clicked')
    and notEmpty($session_id)
  group by sid
  having pageviews > 0
  limit ${LIMIT}`)
if (sessions.length >= LIMIT)
  throw new Error(`hit the ${LIMIT}-row cap; narrow --since`)

const SEARCH =
  /(^|\.)(google|bing|duckduckgo|kagi|yahoo|ecosia)\.|search\.brave|googlequicksearchbox/
function platformOf(s) {
  const u = (s.utm_source || '').toLowerCase()
  const utmMap = {
    ig: 'instagram',
    fb: 'facebook',
    li: 'linkedin',
    yt: 'youtube',
    tt: 'tiktok',
  }
  if (u) return { platform: utmMap[u] || u, via: 'utm' }
  const ua = s.ua || ''
  if (/Instagram/i.test(ua)) return { platform: 'instagram', via: 'app' }
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return { platform: 'facebook', via: 'app' }
  if (/LinkedInApp/i.test(ua)) return { platform: 'linkedin', via: 'app' }
  if (/musical_ly|Bytedance|TikTok/i.test(ua))
    return { platform: 'tiktok', via: 'app' }
  const rd = (s.rd || '').toLowerCase()
  if (/instagram/.test(rd)) return { platform: 'instagram', via: 'referrer' }
  if (/messenger/.test(rd)) return { platform: 'messenger', via: 'referrer' }
  if (/facebook/.test(rd)) return { platform: 'facebook', via: 'referrer' }
  if (/linkedin|lnkd\.in/.test(rd))
    return { platform: 'linkedin', via: 'referrer' }
  if (/youtube|youtu\.be/.test(rd))
    return { platform: 'youtube', via: 'referrer' }
  if (/tiktok/.test(rd)) return { platform: 'tiktok', via: 'referrer' }
  if (SEARCH.test(rd)) return { platform: 'search', via: 'referrer' }
  if (!rd || rd === '$direct') return { platform: 'direct', via: 'none' }
  if (/battleofthetechbands|battleoftheagilebands/.test(rd))
    return { platform: 'internal', via: 'referrer' }
  return { platform: 'other', via: 'referrer' }
}
const SOCIAL = ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube']

for (const s of sessions) {
  Object.assign(s, platformOf(s))
  s.t = new Date(s.start).getTime()
  s.ticket = s.ticket_clicks > 0
  s.ticketFor = (s.ticket_events || []).filter(Boolean)
}

// ---- posts ---------------------------------------------------------------------------
const posts = await sql(
  `select p.id, p.platform, p.group_key, p.content_type, p.event_id, p.permalink,
          p.posted_at, p.utm_content, p.caption,
          m.views, m.likes, m.impressions, m.captured_at
     from posts p
     left join lateral (
       select views, likes, impressions, captured_at from post_metrics
        where post_id = p.id order by captured_at desc limit 1) m on true
    where p.status = 'published' and p.posted_at >= $1::date
    order by p.posted_at`,
  [SINCE]
)
for (const p of posts) {
  p.t = new Date(p.posted_at).getTime()
  p.hasLink = /battleofthetechbands\.com|bottb\.com/i.test(p.caption || '')
  p.sessions = []
}

// ---- attribution ---------------------------------------------------------------------
const byUtm = new Map(
  posts.filter((p) => p.utm_content).map((p) => [p.utm_content, p])
)
const W = WINDOW_H * 3600e3
for (const s of sessions) {
  if (!SOCIAL.includes(s.platform)) continue
  let post = s.utm_content ? byUtm.get(s.utm_content) : undefined
  if (post) s.match = 'utm'
  else {
    post = posts
      .filter((p) => p.platform === s.platform && p.t <= s.t && s.t < p.t + W)
      .at(-1)
    if (post) s.match = 'window'
  }
  if (post) post.sessions.push(s)
}

// ---- report --------------------------------------------------------------------------
const inScope = (s) =>
  !EVENT || s.landing?.includes(EVENT) || s.ticketFor.includes(EVENT)
const scoped = sessions.filter(inScope)
const rate = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '-')
const fmt = (t) =>
  new Date(t).toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

const platforms = [...new Set(scoped.map((s) => s.platform))]
const summary = platforms
  .map((pl) => {
    const ss = scoped.filter((s) => s.platform === pl)
    return {
      platform: pl,
      sessions: ss.length,
      ticket_sessions: ss.filter((s) => s.ticket).length,
      via_app_ua: ss.filter((s) => s.via === 'app').length,
      via_utm: ss.filter((s) => s.via === 'utm').length,
      credited_to_post: ss.filter((s) => s.match).length,
    }
  })
  .sort((a, b) => b.sessions - a.sessions)

const days = Math.max(
  1,
  (Date.now() - new Date(`${SINCE}T00:00:00+10:00`).getTime()) / 86400e3
)
const perPost = posts
  .filter((p) => !EVENT || p.event_id === EVENT || p.sessions.some(inScope))
  .map((p) => {
    const ss = p.sessions.filter(inScope)
    const platformSessions = scoped.filter(
      (s) => s.platform === p.platform
    ).length
    const landings = {}
    for (const s of ss) landings[s.landing] = (landings[s.landing] || 0) + 1
    return {
      posted: fmt(p.t),
      platform: p.platform,
      post: (p.group_key || (p.caption || '').replace(/\s+/g, ' ')).slice(
        0,
        48
      ),
      content_type: p.content_type,
      link_in_caption: p.hasLink,
      views: p.views ?? null,
      likes: p.likes ?? null,
      site_sessions: ss.length,
      baseline: +((platformSessions / days) * (WINDOW_H / 24)).toFixed(1),
      ticket_sessions: ss.filter((s) => s.ticket).length,
      utm_sessions: ss.filter((s) => s.match === 'utm').length,
      // tagged Instagram bio link: known platform, unknown post
      bio_sessions: ss.filter((s) =>
        /link_in_bio|bio/i.test(s.utm_content || '')
      ).length,
      top_landing:
        Object.entries(landings).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }
  })

const out = {
  since: SINCE,
  window_hours: WINDOW_H,
  event: EVENT,
  sessions_total: scoped.length,
  ticket_sessions_total: scoped.filter((s) => s.ticket).length,
  posts_published: posts.length,
  posts_with_utm: posts.filter((p) => p.utm_content).length,
  summary,
  per_post: perPost,
}

if (JSON_OUT) {
  console.log(JSON.stringify(out, null, 2))
} else {
  console.log(
    `Site sessions since ${SINCE}${EVENT ? ` touching ${EVENT}` : ''}: ${out.sessions_total}, ` +
      `ticket sessions ${out.ticket_sessions_total} (${rate(out.ticket_sessions_total, out.sessions_total)}). ` +
      `Posts: ${out.posts_published}, with UTM: ${out.posts_with_utm}. Window ${WINDOW_H} h.\n`
  )
  console.table(
    summary.map((r) => ({
      ...r,
      ticket_rate: rate(r.ticket_sessions, r.sessions),
    }))
  )
  console.log(
    `Per post (baseline = that platform's average sessions per ${WINDOW_H} h over the period):`
  )
  console.table(perPost)
}
