import { sql, sqlQuery } from '../sql'
import type {
  CollabPolicy,
  EventParty,
  EventPartyRole,
  HandleStatus,
  PartyKind,
  PartyWithHandles,
  SocialHandle,
  SocialParty,
  SocialPlatform,
} from '../db-types'

// ============================================================
// Social parties and handles
//
// Handles are national: one Facebook page, one Instagram, one
// TikTok, one YouTube channel across every city. Nothing here is
// scoped by event. `event_parties` only records who is CREDITED
// on a given event's posts.
// ============================================================

export async function listParties(kind?: PartyKind): Promise<SocialParty[]> {
  if (kind) {
    const { rows } = await sql<SocialParty>`
      SELECT * FROM social_parties WHERE kind = ${kind} ORDER BY name
    `
    return rows
  }
  const { rows } = await sql<SocialParty>`
    SELECT * FROM social_parties ORDER BY kind, name
  `
  return rows
}

export async function getParty(slug: string): Promise<SocialParty | null> {
  const { rows } = await sql<SocialParty>`
    SELECT * FROM social_parties WHERE slug = ${slug}
  `
  return rows[0] ?? null
}

export interface AddPartyInput {
  slug: string
  kind: PartyKind
  name: string
  company_slug?: string | null
  photographer_slug?: string | null
  videographer_slug?: string | null
  notes?: string | null
}

export async function addParty(input: AddPartyInput): Promise<SocialParty> {
  const { rows } = await sql<SocialParty>`
    INSERT INTO social_parties
      (slug, kind, name, company_slug, photographer_slug, videographer_slug, notes)
    VALUES
      (${input.slug}, ${input.kind}, ${input.name}, ${input.company_slug ?? null},
       ${input.photographer_slug ?? null}, ${input.videographer_slug ?? null},
       ${input.notes ?? null})
    ON CONFLICT (slug) DO UPDATE SET
      kind = EXCLUDED.kind,
      name = EXCLUDED.name,
      company_slug = COALESCE(EXCLUDED.company_slug, social_parties.company_slug),
      photographer_slug = COALESCE(EXCLUDED.photographer_slug, social_parties.photographer_slug),
      videographer_slug = COALESCE(EXCLUDED.videographer_slug, social_parties.videographer_slug),
      notes = COALESCE(EXCLUDED.notes, social_parties.notes),
      updated_at = now()
    RETURNING *
  `
  return rows[0]
}

/**
 * Handles for every party, or narrowed to one event's credited parties and/or
 * one platform.
 *
 * The event filter is about credit, not about the accounts: a party credited
 * at Brisbane 2026 has the same national Instagram it has everywhere.
 */
export async function listHandles(opts: {
  eventId?: string
  platform?: SocialPlatform
  party?: string
}): Promise<PartyWithHandles[]> {
  const where: string[] = []
  const params: unknown[] = []

  if (opts.eventId) {
    params.push(opts.eventId)
    where.push(
      `p.slug IN (SELECT party_slug FROM event_parties WHERE event_id = $${params.length})`
    )
  }
  if (opts.party) {
    params.push(opts.party)
    where.push(`p.slug = $${params.length}`)
  }

  const handleWhere: string[] = []
  if (opts.platform) {
    params.push(opts.platform)
    handleWhere.push(`h.platform = $${params.length}`)
  }

  const text = `
    SELECT p.*,
           COALESCE(
             json_agg(to_jsonb(h.*) ORDER BY h.platform)
               FILTER (WHERE h.party_slug IS NOT NULL),
             '[]'
           ) AS handles
    FROM social_parties p
    LEFT JOIN social_handles h
      ON h.party_slug = p.slug
      ${handleWhere.length ? `AND ${handleWhere.join(' AND ')}` : ''}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    GROUP BY p.slug
    ORDER BY p.kind, p.name
  `
  const { rows } = await sqlQuery<PartyWithHandles>(text, params)
  return rows
}

export interface SetHandleInput {
  party_slug: string
  platform: SocialPlatform
  status?: HandleStatus
  handle?: string | null
  mention_name?: string | null
  url?: string | null
  external_id?: string | null
  collab_policy?: CollabPolicy
  notes?: string | null
  verified_by?: string | null
  verified_at?: string | null
}

const HANDLE_FIELDS = [
  'status',
  'handle',
  'mention_name',
  'url',
  'external_id',
  'collab_policy',
  'notes',
  'verified_by',
  'verified_at',
] as const

/**
 * Upsert one (party, platform) handle. Only the fields you pass are touched,
 * so `handles set --party x --platform linkedin --notes '...'` does not blank
 * out the URL somebody verified last week.
 */
export async function setHandle(input: SetHandleInput): Promise<SocialHandle> {
  const provided = HANDLE_FIELDS.filter(
    (f) => input[f] !== undefined
  ) as (typeof HANDLE_FIELDS)[number][]

  const cols = ['party_slug', 'platform', ...provided]
  const values: unknown[] = [
    input.party_slug,
    input.platform,
    ...provided.map((f) => input[f]),
  ]
  const placeholders = values.map((_, i) => `$${i + 1}`)
  const updates = provided.map((f, i) => `${f} = $${i + 3}`)
  updates.push('updated_at = now()')

  const text = `
    INSERT INTO social_handles (${cols.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (party_slug, platform) DO UPDATE SET ${updates.join(', ')}
    RETURNING *
  `
  const { rows } = await sqlQuery<SocialHandle>(text, values)
  return rows[0]
}

/**
 * Stamp a handle as checked. Optionally changes the status at the same time,
 * because "I looked and they still have no TikTok" is a verification too.
 */
export async function verifyHandle(
  partySlug: string,
  platform: SocialPlatform,
  verifiedBy: string,
  status?: HandleStatus,
  notes?: string
): Promise<SocialHandle | null> {
  const { rows } = await sql<SocialHandle>`
    UPDATE social_handles
    SET verified_at = now(),
        verified_by = ${verifiedBy},
        status = COALESCE(${status ?? null}::varchar, status),
        notes = COALESCE(${notes ?? null}::text, notes),
        updated_at = now()
    WHERE party_slug = ${partySlug} AND platform = ${platform}
    RETURNING *
  `
  return rows[0] ?? null
}

export async function listEventParties(
  eventId: string
): Promise<(EventParty & { name: string; kind: PartyKind })[]> {
  const { rows } = await sql<EventParty & { name: string; kind: PartyKind }>`
    SELECT ep.*, p.name, p.kind
    FROM event_parties ep
    JOIN social_parties p ON p.slug = ep.party_slug
    WHERE ep.event_id = ${eventId}
    ORDER BY ep.role, p.name
  `
  return rows
}

export async function addEventParty(
  eventId: string,
  partySlug: string,
  role: EventPartyRole,
  notes?: string | null
): Promise<EventParty> {
  const { rows } = await sql<EventParty>`
    INSERT INTO event_parties (event_id, party_slug, role, notes)
    VALUES (${eventId}, ${partySlug}, ${role}, ${notes ?? null})
    ON CONFLICT (event_id, party_slug, role)
      DO UPDATE SET notes = COALESCE(EXCLUDED.notes, event_parties.notes)
    RETURNING *
  `
  return rows[0]
}
