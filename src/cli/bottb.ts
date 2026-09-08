#!/usr/bin/env tsx
/**
 * `bottb` - the operational CLI for running a Battle of the Tech Bands event's
 * social presence.
 *
 * Everything it knows lives in the database, not in a session's head. The
 * Brisbane 2026 run was recorded in a hand-written JSONL log by a session that
 * crashed twice; the log ends with a correction to a posting time that was
 * written from memory and was two hours wrong. This CLI exists so the next
 * run does not depend on any of that.
 *
 * Conventions:
 *   - stdout is the answer. Everything else goes to stderr.
 *   - `--json` wraps the answer in {ok, command, data, meta} for a skill to
 *     consume.
 *   - Anything that writes to the database says what it will do first.
 */

import { parseArgs } from 'node:util'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  CliError,
  emitJson,
  emitJsonError,
  isJson,
  log,
  out,
  setJsonMode,
  setQuiet,
  table,
  warn,
} from './output'
import { connect, type TransportInfo } from './transport'
import { interpretBrisbaneLog, type PlannedPost } from './backfill/brisbane-log'
import {
  COLLAB_POLICIES,
  EVENT_PARTY_ROLES,
  HANDLE_STATUSES,
  PARTY_KINDS,
  POST_CONTENT_TYPES,
  POST_STATUSES,
  POSTED_VIA,
  SOCIAL_PLATFORMS,
  type Post,
} from '../lib/db-types'
import {
  addEventParty,
  addParty,
  listEventParties,
  listHandles,
  listParties,
  setHandle,
  verifyHandle,
} from '../lib/db/social-parties'
import {
  listPosts,
  listPostsByGroup,
  recordPost,
  updatePost,
  getPostByExternalId,
} from '../lib/db/posts'
import { trackedUrlForPost } from '../lib/social/utm'
import { whatsappText } from './whatsapp'
import { getEventById, getUpcomingEvents } from '../lib/db/events'
import { getBandsForEvent } from '../lib/db/bands'
import { sql, sqlQuery } from '../lib/sql'

const USAGE = `bottb - Battle of the Tech Bands operations CLI

  doctor                                Check the environment, transport and schema
  event next                            The next upcoming event
  event show [<event-id>]               An event, its bands and its credited parties
  event party add --event --party --role [--notes]

  handles [--event] [--platform] [--party]
                                        Who to tag, and how, per platform
  handles set --party --platform [--status --handle --mention-name --url
              --external-id --collab-policy --notes]
  handles verify --party --platform [--by] [--status] [--notes]

  party list [--kind]
  party add --slug --kind --name [--company --photographer --videographer --notes]

  post record --platform [--group --external-id --permalink --status
              --content-type --event --band --title --caption --media-url
              --collaborators --mentions --scheduled-for --posted-at
              --posted-at-estimated --posted-via --utm-medium --utm-content
              --notes]
  post update (--id | --platform --external-id) [<same fields>]
  post list [--event --band --platform --group --status --since --limit]
  post link (--id | --platform --external-id) [--target]
                                        Build the UTM-tagged caption link
  post whatsapp --group <group-key>     Plain text summary to paste into WhatsApp

  backfill brisbane-2026-log [--file] [--apply --yes]
                                        DRY RUN unless BOTH --apply and --yes

Global: --json  --quiet  --help
`

// ---------------------------------------------------------------------------
// Arg helpers
// ---------------------------------------------------------------------------

type Options = Record<string, string | boolean | undefined>

function parse(
  argv: string[],
  spec: Record<string, { type: 'string' | 'boolean'; multiple?: boolean }>
): { values: Options; positionals: string[] } {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      json: { type: 'boolean' },
      quiet: { type: 'boolean' },
      help: { type: 'boolean' },
      yes: { type: 'boolean' },
      ...spec,
    },
    allowPositionals: true,
    strict: true,
  })
  return { values: values as Options, positionals }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function required(values: Options, name: string): string {
  const v = str(values[name])
  if (!v) throw new CliError('missing_argument', `--${name} is required`)
  return v
}

function oneOf<T extends string>(
  values: Options,
  name: string,
  allowed: readonly T[],
  fallback?: T
): T | undefined {
  const v = str(values[name])
  if (v === undefined) return fallback
  if (!(allowed as readonly string[]).includes(v)) {
    throw new CliError(
      'bad_argument',
      `--${name} must be one of: ${allowed.join(', ')} (got "${v}")`
    )
  }
  return v as T
}

function list(values: Options, name: string): string[] | undefined {
  const v = str(values[name])
  if (v === undefined) return undefined
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdDoctor(transport: TransportInfo) {
  const envKeys = ['POSTGRES_URL', 'DATABASE_URL', 'BLOB_READ_WRITE_TOKEN']
  const env = envKeys.map((k) => ({ key: k, present: !!process.env[k] }))

  const tables = [
    'events',
    'bands',
    'social_parties',
    'social_handles',
    'event_parties',
    'posts',
  ]
  const present: Record<string, number | null> = {}
  for (const t of tables) {
    try {
      const { rows } = await sql<{ n: string }>`
        SELECT count(*)::text AS n FROM information_schema.tables
        WHERE table_name = ${t} AND table_schema = 'public'
      `
      if (rows[0]?.n === '0') {
        present[t] = null
        continue
      }
      // Table names cannot be bound as parameters, so the name is validated
      // against a hard allowlist above and matched against a strict pattern
      // before it is ever interpolated.
      if (!/^[a-z_][a-z0-9_]*$/.test(t)) {
        throw new CliError('bad_identifier', `unsafe identifier: ${t}`)
      }
      const { rows: counted } = await sqlQuery<{ n: string }>(
        `SELECT count(*)::text AS n FROM ${t}`
      )
      present[t] = Number(counted[0].n)
    } catch (err) {
      present[t] = null
      warn(`could not read ${t}: ${err instanceof Error ? err.message : err}`)
    }
  }

  const views: Record<string, boolean> = {}
  for (const v of ['party_handles', 'company_handles']) {
    const { rows } = await sql<{ n: string }>`
      SELECT count(*)::text AS n FROM information_schema.views
      WHERE table_name = ${v} AND table_schema = 'public'
    `
    views[v] = rows[0]?.n !== '0'
  }

  const missing = Object.entries(present)
    .filter(([, v]) => v === null)
    .map(([k]) => k)

  if (isJson()) {
    emitJson(
      'doctor',
      { env, tables: present, views, migrationsNeeded: missing },
      { transport: transport.transport }
    )
    return
  }

  out(`transport   ${transport.transport} -> ${transport.host ?? 'unknown'}`)
  out(
    `latency     ${transport.latencyMs}ms${transport.fallbackUsed ? '  (FALLBACK)' : ''}`
  )
  out('')
  out(
    table(
      ['env', 'present'],
      env.map((e) => [e.key, e.present ? 'yes' : 'NO'])
    )
  )
  out('')
  out(
    table(
      ['table', 'rows'],
      Object.entries(present).map(([k, v]) => [
        k,
        v === null ? 'MISSING' : String(v),
      ])
    )
  )
  out('')
  out(
    table(
      ['view', 'present'],
      Object.entries(views).map(([k, v]) => [k, v ? 'yes' : 'NO'])
    )
  )
  if (missing.length) {
    out('')
    out(`Run \`pnpm migrate\` - missing: ${missing.join(', ')}`)
  }
}

async function cmdEventNext(transport: TransportInfo) {
  const events = await getUpcomingEvents()
  const next = events[0]
  if (!next) throw new CliError('not_found', 'no upcoming events')
  if (isJson()) {
    emitJson('event next', next, { transport: transport.transport })
    return
  }
  out(`${next.id}  ${next.name}`)
  out(`${next.date}  ${next.location}`)
}

async function cmdEventShow(eventId: string, transport: TransportInfo) {
  const event = await getEventById(eventId)
  if (!event) throw new CliError('not_found', `no event "${eventId}"`)
  const bands = await getBandsForEvent(eventId)
  const parties = await listEventParties(eventId)

  if (isJson()) {
    emitJson(
      'event show',
      { event, bands, parties },
      { transport: transport.transport }
    )
    return
  }
  out(`${event.id}  ${event.name}`)
  out(`${event.date}  ${event.location}  (${event.timezone})`)
  out('')
  out('Bands')
  out(
    table(
      ['id', 'name', 'company'],
      bands.map((b) => [b.id, b.name, b.company_slug ?? null])
    )
  )
  out('')
  out('Credited parties')
  out(
    table(
      ['role', 'party', 'name'],
      parties.map((p) => [p.role, p.party_slug, p.name])
    )
  )
}

const HANDLE_COLUMNS = [
  'linkedin',
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
] as const

async function cmdHandles(values: Options, transport: TransportInfo) {
  const platform = oneOf(values, 'platform', SOCIAL_PLATFORMS)
  const parties = await listHandles({
    eventId: str(values.event),
    platform,
    party: str(values.party),
  })

  if (isJson()) {
    emitJson('handles', parties, {
      transport: transport.transport,
      count: parties.length,
    })
    return
  }

  if (platform) {
    out(
      table(
        ['party', 'status', 'handle', 'mention name', 'collab', 'notes'],
        parties.map((p) => {
          const h = p.handles[0]
          return [
            p.slug,
            h?.status ?? 'unchecked',
            h?.handle ?? null,
            h?.mention_name ?? null,
            h?.collab_policy ?? null,
            h?.notes ? h.notes.split('\n')[0].slice(0, 60) : null,
          ]
        })
      )
    )
    return
  }

  // The flat, per-platform-column shape, which is what the view exists for.
  out(
    table(
      ['party', 'kind', ...HANDLE_COLUMNS],
      parties.map((p) => [
        p.slug,
        p.kind,
        ...HANDLE_COLUMNS.map((platformName) => {
          const h = p.handles.find((x) => x.platform === platformName)
          if (!h) return '?' // nobody has checked
          if (h.status === 'none') return 'none'
          if (h.status === 'unknown') return '? unknown'
          const label = h.handle ?? h.mention_name ?? h.external_id ?? 'yes'
          return h.collab_policy === 'never' ? `${label} (no collab)` : label
        }),
      ])
    )
  )
  out('')
  out(
    '?  nobody has checked      ? unknown  checked, inconclusive      none  no account'
  )
}

async function cmdHandlesSet(values: Options, transport: TransportInfo) {
  const platform = oneOf(values, 'platform', SOCIAL_PLATFORMS)
  if (!platform)
    throw new CliError('missing_argument', '--platform is required')
  const handle = await setHandle({
    party_slug: required(values, 'party'),
    platform,
    status: oneOf(values, 'status', HANDLE_STATUSES),
    handle: str(values.handle),
    mention_name: str(values['mention-name']),
    url: str(values.url),
    external_id: str(values['external-id']),
    collab_policy: oneOf(values, 'collab-policy', COLLAB_POLICIES),
    notes: str(values.notes),
  })
  if (isJson()) {
    emitJson('handles set', handle, { transport: transport.transport })
    return
  }
  out(
    `${handle.party_slug}/${handle.platform}: ${handle.status} ${handle.handle ?? ''}`
  )
}

async function cmdHandlesVerify(values: Options, transport: TransportInfo) {
  const party = required(values, 'party')
  const platform = oneOf(values, 'platform', SOCIAL_PLATFORMS)
  if (!platform)
    throw new CliError('missing_argument', '--platform is required')
  const by = str(values.by) ?? process.env.USER ?? 'unknown'
  const handle = await verifyHandle(
    party,
    platform,
    by,
    oneOf(values, 'status', HANDLE_STATUSES),
    str(values.notes)
  )
  if (!handle) {
    throw new CliError(
      'not_found',
      `no handle row for ${party}/${platform}. Use \`handles set\` first - there is a difference between "checked, inconclusive" and "never checked", and this command only records the former.`
    )
  }
  if (isJson()) {
    emitJson('handles verify', handle, { transport: transport.transport })
    return
  }
  out(`${party}/${platform} verified by ${by} at ${handle.verified_at}`)
}

async function cmdPartyList(values: Options, transport: TransportInfo) {
  const parties = await listParties(oneOf(values, 'kind', PARTY_KINDS))
  if (isJson()) {
    emitJson('party list', parties, {
      transport: transport.transport,
      count: parties.length,
    })
    return
  }
  out(
    table(
      ['slug', 'kind', 'name', 'company'],
      parties.map((p) => [p.slug, p.kind, p.name, p.company_slug])
    )
  )
}

async function cmdPartyAdd(values: Options, transport: TransportInfo) {
  const kind = oneOf(values, 'kind', PARTY_KINDS)
  if (!kind) throw new CliError('missing_argument', '--kind is required')
  const party = await addParty({
    slug: required(values, 'slug'),
    kind,
    name: required(values, 'name'),
    company_slug: str(values.company),
    photographer_slug: str(values.photographer),
    videographer_slug: str(values.videographer),
    notes: str(values.notes),
  })
  if (isJson()) {
    emitJson('party add', party, { transport: transport.transport })
    return
  }
  out(`${party.slug} (${party.kind}) ${party.name}`)
  log('No handles yet. Add them with `bottb handles set`.')
}

async function cmdEventPartyAdd(values: Options, transport: TransportInfo) {
  const role = oneOf(values, 'role', EVENT_PARTY_ROLES)
  if (!role) throw new CliError('missing_argument', '--role is required')
  const row = await addEventParty(
    required(values, 'event'),
    required(values, 'party'),
    role,
    str(values.notes)
  )
  if (isJson()) {
    emitJson('event party add', row, { transport: transport.transport })
    return
  }
  out(`${row.event_id}: ${row.party_slug} as ${row.role}`)
}

function postFieldsFromArgs(values: Options) {
  const platform = oneOf(values, 'platform', SOCIAL_PLATFORMS)
  return {
    platform,
    group_key: str(values.group),
    external_id: str(values['external-id']),
    permalink: str(values.permalink),
    status: oneOf(values, 'status', POST_STATUSES),
    content_type: oneOf(values, 'content-type', POST_CONTENT_TYPES),
    event_id: str(values.event),
    band_id: str(values.band),
    title: str(values.title),
    caption: str(values.caption),
    media_url: str(values['media-url']),
    collaborators: list(values, 'collaborators'),
    mentions: list(values, 'mentions'),
    scheduled_for: str(values['scheduled-for']),
    posted_at: str(values['posted-at']),
    posted_at_estimated:
      values['posted-at-estimated'] === undefined
        ? undefined
        : values['posted-at-estimated'] === true ||
          values['posted-at-estimated'] === 'true',
    posted_tz: str(values['posted-tz']),
    posted_via: oneOf(values, 'posted-via', POSTED_VIA),
    utm_campaign: str(values['utm-campaign']),
    utm_source: str(values['utm-source']),
    utm_medium: str(values['utm-medium']),
    utm_content: str(values['utm-content']),
    notes: str(values.notes),
  }
}

async function cmdPostRecord(values: Options, transport: TransportInfo) {
  const fields = postFieldsFromArgs(values)
  if (!fields.platform) {
    throw new CliError('missing_argument', '--platform is required')
  }
  if (fields.posted_at && fields.posted_at_estimated === undefined) {
    warn(
      'no --posted-at-estimated given, so this time is being recorded as MEASURED. If you did not read it back from the platform (Facebook created_time, Instagram timestamp, LinkedIn id>>22, TikTok id>>32), pass --posted-at-estimated.'
    )
  }
  const post = await recordPost({
    ...fields,
    platform: fields.platform,
    source: str(values.source) ?? 'cli',
  } as Parameters<typeof recordPost>[0])
  if (isJson()) {
    emitJson('post record', post, { transport: transport.transport })
    return
  }
  out(`${post.id}  ${post.platform}  ${post.status}  ${post.permalink ?? ''}`)
}

async function resolvePost(values: Options): Promise<Post> {
  const id = str(values.id)
  if (id) {
    const { rows } = await sql<Post>`SELECT * FROM posts WHERE id = ${id}`
    if (!rows[0]) throw new CliError('not_found', `no post ${id}`)
    return rows[0]
  }
  const platform = oneOf(values, 'platform', SOCIAL_PLATFORMS)
  const externalId = str(values['external-id'])
  if (!platform || !externalId) {
    throw new CliError(
      'missing_argument',
      'pass --id, or both --platform and --external-id'
    )
  }
  const post = await getPostByExternalId(platform, externalId)
  if (!post) {
    throw new CliError('not_found', `no ${platform} post ${externalId}`)
  }
  return post
}

async function cmdPostUpdate(values: Options, transport: TransportInfo) {
  const existing = await resolvePost(values)
  const fields = postFieldsFromArgs(values)
  // --platform and --external-id are how we FOUND it; do not rewrite identity
  // from them, or a typo silently moves a row onto another platform.
  const patch = { ...fields }
  delete (patch as Record<string, unknown>).platform
  if (!str(values.id)) delete (patch as Record<string, unknown>).external_id

  const updated = await updatePost(
    existing.id,
    patch as Parameters<typeof updatePost>[1]
  )
  if (isJson()) {
    emitJson('post update', updated, { transport: transport.transport })
    return
  }
  out(`${updated?.id}  ${updated?.platform}  ${updated?.status}`)
}

async function cmdPostList(values: Options, transport: TransportInfo) {
  const posts = await listPosts({
    eventId: str(values.event),
    bandId: str(values.band),
    platform: oneOf(values, 'platform', SOCIAL_PLATFORMS),
    groupKey: str(values.group),
    status: oneOf(values, 'status', POST_STATUSES),
    since: str(values.since),
    limit: values.limit ? Number(values.limit) : undefined,
  })
  if (isJson()) {
    emitJson('post list', posts, {
      transport: transport.transport,
      count: posts.length,
    })
    return
  }
  out(
    table(
      ['when', 'est', 'platform', 'status', 'group', 'link'],
      posts.map((p) => [
        (p.posted_at ?? p.scheduled_for ?? '').slice(0, 16) || null,
        p.posted_at_estimated ? '~' : '',
        p.platform,
        p.status,
        p.group_key,
        p.permalink,
      ])
    )
  )
  out('')
  out('~ marks an ESTIMATED time - inferred, not read back from the platform.')
}

async function cmdPostLink(values: Options, transport: TransportInfo) {
  const post = await resolvePost(values)
  const url = trackedUrlForPost(post, str(values.target))
  if (isJson()) {
    emitJson(
      'post link',
      { id: post.id, platform: post.platform, url },
      { transport: transport.transport }
    )
    return
  }
  out(url)
}

async function cmdPostWhatsapp(values: Options, transport: TransportInfo) {
  const group = required(values, 'group')
  const posts = (await listPostsByGroup(group)).filter(
    (p) => p.status !== 'deleted' && p.status !== 'withdrawn'
  )
  const text = whatsappText(posts)
  if (isJson()) {
    emitJson(
      'post whatsapp',
      { group, text },
      { transport: transport.transport, count: posts.length }
    )
    return
  }
  out(text)
}

// ---------------------------------------------------------------------------
// backfill
// ---------------------------------------------------------------------------

const DEFAULT_LOG = 'doc/production/brisbane-2026-reel-schedule-log.jsonl'

async function cmdBackfill(values: Options, transport: TransportInfo) {
  const file = resolve(process.cwd(), str(values.file) ?? DEFAULT_LOG)
  const result = interpretBrisbaneLog(readFileSync(file, 'utf8'))

  const apply = values.apply === true && values.yes === true
  if (values.apply === true && values.yes !== true) {
    throw new CliError(
      'confirmation_required',
      '--apply also needs --yes. This writes to whatever DATABASE_URL points at, which is production.'
    )
  }

  // Resolve the band ids against the database rather than trusting the slug
  // pattern. A band id that does not exist would fail the foreign key, and
  // reporting that in a dry run is the whole point of a dry run.
  const bandIds = [
    ...new Set(result.posts.map((p) => p.band_id).filter(Boolean)),
  ] as string[]
  const known = new Set<string>()
  if (bandIds.length) {
    const { rows } = await sqlQuery<{ id: string }>(
      'SELECT id FROM bands WHERE id = ANY($1::text[])',
      [bandIds]
    )
    for (const r of rows) known.add(r.id)
  }
  const unknownBands = bandIds.filter((b) => !known.has(b))
  const eventExists = !!(await getEventById('brisbane-2026'))

  const blockers: string[] = []
  if (!eventExists) blockers.push('event "brisbane-2026" does not exist')
  for (const b of unknownBands) {
    blockers.push(`band "${b}" does not exist; its posts will be left unlinked`)
  }

  const toWrite: PlannedPost[] = result.posts.map((p) => ({
    ...p,
    band_id: p.band_id && known.has(p.band_id) ? p.band_id : null,
    event_id: eventExists ? p.event_id : (null as unknown as string),
  }))

  if (isJson()) {
    emitJson(
      'backfill brisbane-2026-log',
      {
        posts: toWrite,
        warnings: result.warnings,
        unrecoverable: result.unrecoverable,
        superseded: result.superseded,
        ignored: result.ignored,
        unhandled: result.unhandled,
        blockers,
      },
      {
        transport: transport.transport,
        count: toWrite.length,
        dryRun: !apply,
      }
    )
    if (!apply) return
  } else {
    renderBackfill(toWrite, result, blockers, apply)
    if (!apply) return
  }

  let written = 0
  let skipped = 0
  for (const p of toWrite) {
    // A post with no external id has nothing for ON CONFLICT to match on, so
    // a second --apply would duplicate it. The two LinkedIn reels whose
    // permalinks were never recorded are exactly that case.
    if (!p.external_id) {
      const existing = await listPosts({
        groupKey: p.group_key,
        platform: p.platform,
      })
      if (existing.some((e) => !e.external_id && e.source === p.source)) {
        skipped++
        continue
      }
    }
    await recordPost({
      group_key: p.group_key,
      platform: p.platform,
      external_id: p.external_id,
      permalink: p.permalink,
      status: p.status,
      content_type: p.content_type,
      event_id: p.event_id,
      band_id: p.band_id,
      title: p.title,
      collaborators: p.collaborators,
      media_url: p.media_url,
      scheduled_for: p.scheduled_for,
      posted_at: p.posted_at,
      posted_at_estimated: p.posted_at_estimated,
      posted_tz: p.posted_tz,
      posted_via: p.posted_via,
      source: p.source,
      metadata: { ...p.metadata, log_lines: p.lines },
      notes: p.notes,
    })
    written++
  }
  log(`wrote ${written} posts, skipped ${skipped} already present`)
  if (!isJson()) {
    out(`Applied. ${written} posts written, ${skipped} already present.`)
  }
}

function renderBackfill(
  posts: PlannedPost[],
  result: ReturnType<typeof interpretBrisbaneLog>,
  blockers: string[],
  apply: boolean
) {
  out(apply ? 'APPLYING' : 'DRY RUN - nothing will be written')
  out('')
  out(
    table(
      ['group', 'platform', 'status', 'when', 'est', 'external id'],
      posts.map((p) => [
        p.group_key,
        p.platform,
        p.status,
        (p.posted_at ?? p.scheduled_for ?? '').slice(0, 16) || null,
        p.posted_at_estimated ? '~' : '',
        p.external_id,
      ])
    )
  )
  out('')
  out(`${posts.length} posts.`)

  const section = (title: string, items: string[]) => {
    if (items.length === 0) return
    out('')
    out(title)
    for (const i of items) out(`  - ${i}`)
  }

  section('Cannot be recovered from the log:', result.unrecoverable)
  section('Later lines overrode earlier ones:', result.superseded)
  section('Worth knowing:', result.warnings)
  section('Recognised, not a publication:', result.ignored)
  section('NOT UNDERSTOOD (nothing was inferred from these):', result.unhandled)
  section('Blockers:', blockers)

  if (!apply) {
    out('')
    out('To write these: bottb backfill brisbane-2026-log --apply --yes')
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const SPEC: Record<string, { type: 'string' | 'boolean' }> = {
  event: { type: 'string' },
  platform: { type: 'string' },
  party: { type: 'string' },
  kind: { type: 'string' },
  slug: { type: 'string' },
  name: { type: 'string' },
  company: { type: 'string' },
  photographer: { type: 'string' },
  videographer: { type: 'string' },
  role: { type: 'string' },
  status: { type: 'string' },
  handle: { type: 'string' },
  'mention-name': { type: 'string' },
  url: { type: 'string' },
  'external-id': { type: 'string' },
  'collab-policy': { type: 'string' },
  notes: { type: 'string' },
  by: { type: 'string' },
  id: { type: 'string' },
  group: { type: 'string' },
  permalink: { type: 'string' },
  'content-type': { type: 'string' },
  band: { type: 'string' },
  title: { type: 'string' },
  caption: { type: 'string' },
  'media-url': { type: 'string' },
  collaborators: { type: 'string' },
  mentions: { type: 'string' },
  'scheduled-for': { type: 'string' },
  'posted-at': { type: 'string' },
  'posted-at-estimated': { type: 'boolean' },
  'posted-tz': { type: 'string' },
  'posted-via': { type: 'string' },
  'utm-campaign': { type: 'string' },
  'utm-source': { type: 'string' },
  'utm-medium': { type: 'string' },
  'utm-content': { type: 'string' },
  source: { type: 'string' },
  since: { type: 'string' },
  limit: { type: 'string' },
  target: { type: 'string' },
  file: { type: 'string' },
  apply: { type: 'boolean' },
}

async function main() {
  const argv = process.argv.slice(2)
  const { values, positionals } = parse(argv, SPEC)

  setJsonMode(values.json === true)
  setQuiet(values.quiet === true)

  const command = positionals.join(' ')
  if (values.help === true || positionals.length === 0) {
    process.stdout.write(USAGE)
    return
  }

  const transport = await connect()

  switch (positionals[0]) {
    case 'doctor':
      return cmdDoctor(transport)
    case 'event':
      if (positionals[1] === 'next') return cmdEventNext(transport)
      if (positionals[1] === 'show') {
        const id = positionals[2] ?? str(values.event)
        if (!id) {
          const next = (await getUpcomingEvents())[0]
          if (!next) throw new CliError('not_found', 'no upcoming event')
          return cmdEventShow(next.id, transport)
        }
        return cmdEventShow(id, transport)
      }
      if (positionals[1] === 'party' && positionals[2] === 'add') {
        return cmdEventPartyAdd(values, transport)
      }
      break
    case 'handles':
      if (positionals[1] === 'set') return cmdHandlesSet(values, transport)
      if (positionals[1] === 'verify')
        return cmdHandlesVerify(values, transport)
      if (positionals.length === 1) return cmdHandles(values, transport)
      break
    case 'party':
      if (positionals[1] === 'list') return cmdPartyList(values, transport)
      if (positionals[1] === 'add') return cmdPartyAdd(values, transport)
      break
    case 'post':
      if (positionals[1] === 'record') return cmdPostRecord(values, transport)
      if (positionals[1] === 'update') return cmdPostUpdate(values, transport)
      if (positionals[1] === 'list') return cmdPostList(values, transport)
      if (positionals[1] === 'link') return cmdPostLink(values, transport)
      if (positionals[1] === 'whatsapp')
        return cmdPostWhatsapp(values, transport)
      break
    case 'backfill':
      if (positionals[1] === 'brisbane-2026-log') {
        return cmdBackfill(values, transport)
      }
      break
  }

  throw new CliError('unknown_command', `unknown command: ${command}`)
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    const code = err instanceof CliError ? err.code : 'error'
    const message = err instanceof Error ? err.message : String(err)
    if (isJson()) {
      emitJsonError(process.argv.slice(2).join(' '), code, message)
    } else {
      process.stderr.write(`[bottb] ${code}: ${message}\n`)
    }
    process.exit(1)
  })
