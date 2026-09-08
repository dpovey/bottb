import { sqlQuery } from '../sql'
import type { Post } from '../db-types'

// ============================================================
// The post ledger: one row per publication per platform.
//
// Distinct from `social_posts`/`social_post_results` in db.ts,
// which are the admin UI's queue of submitted jobs. Most posts
// never go through that queue - they are scheduled natively on
// Facebook, dragged into LinkedIn, or uploaded by hand - so the
// queue tables cannot answer "what did we publish, and when".
// ============================================================

/** Every column a caller may write. `id`, `created_at`, `updated_at` are not. */
export const POST_WRITABLE_FIELDS = [
  'group_key',
  'platform',
  'external_id',
  'permalink',
  'status',
  'content_type',
  'event_id',
  'band_id',
  'video_id',
  'photo_ids',
  'title',
  'caption',
  'collaborators',
  'mentions',
  'media_url',
  'scheduled_for',
  'posted_at',
  'posted_at_estimated',
  'posted_tz',
  'posted_via',
  'permalink_verified_at',
  'utm_campaign',
  'utm_source',
  'utm_medium',
  'utm_content',
  'source',
  'metadata',
  'notes',
] as const

export type PostWritableField = (typeof POST_WRITABLE_FIELDS)[number]
export type PostInput = Partial<Pick<Post, PostWritableField>> & {
  platform: Post['platform']
}

function serialise(field: PostWritableField, value: unknown): unknown {
  if (field === 'metadata' && value !== null && typeof value === 'object') {
    return JSON.stringify(value)
  }
  return value ?? null
}

/**
 * Insert a post, or merge into the existing one with the same
 * (platform, external_id). Merging matters because a post is discovered in
 * pieces: the id when it is scheduled, the permalink after it publishes, the
 * real posting time only when somebody reads it back from the platform.
 *
 * Fields you do not pass are left alone.
 */
export async function recordPost(input: PostInput): Promise<Post> {
  const fields = POST_WRITABLE_FIELDS.filter(
    (f) => input[f] !== undefined
  ) as PostWritableField[]

  const values = fields.map((f) => serialise(f, input[f]))
  const placeholders = fields.map((_, i) => `$${i + 1}`)

  // Without an external_id there is nothing to conflict on, so this is a
  // plain insert and a duplicate run would create a duplicate row.
  const conflict = input.external_id
    ? `ON CONFLICT (platform, external_id) WHERE external_id IS NOT NULL
       DO UPDATE SET ${fields
         .filter((f) => f !== 'platform' && f !== 'external_id')
         .map((f) => `${f} = EXCLUDED.${f}`)
         .join(', ')}`
    : ''

  const text = `
    INSERT INTO posts (${fields.join(', ')})
    VALUES (${placeholders.join(', ')})
    ${conflict}
    RETURNING *
  `
  const { rows } = await sqlQuery<Post>(text, values)
  return rows[0]
}

/** Partial update by id. Only the fields you pass are touched. */
export async function updatePost(
  id: string,
  patch: Partial<Pick<Post, PostWritableField>>
): Promise<Post | null> {
  const fields = POST_WRITABLE_FIELDS.filter((f) => patch[f] !== undefined)
  if (fields.length === 0) return getPostById(id)

  const values = fields.map((f) => serialise(f, patch[f]))
  const sets = fields.map((f, i) => `${f} = $${i + 1}`)
  values.push(id)

  const text = `
    UPDATE posts SET ${sets.join(', ')}
    WHERE id = $${values.length}
    RETURNING *
  `
  const { rows } = await sqlQuery<Post>(text, values)
  return rows[0] ?? null
}

export async function getPostById(id: string): Promise<Post | null> {
  const { rows } = await sqlQuery<Post>('SELECT * FROM posts WHERE id = $1', [
    id,
  ])
  return rows[0] ?? null
}

export async function getPostByExternalId(
  platform: string,
  externalId: string
): Promise<Post | null> {
  const { rows } = await sqlQuery<Post>(
    'SELECT * FROM posts WHERE platform = $1 AND external_id = $2',
    [platform, externalId]
  )
  return rows[0] ?? null
}

export interface ListPostsFilter {
  eventId?: string
  bandId?: string
  platform?: string
  groupKey?: string
  status?: string
  since?: string
  limit?: number
}

export async function listPosts(filter: ListPostsFilter): Promise<Post[]> {
  const where: string[] = []
  const params: unknown[] = []
  const eq = (col: string, value: unknown) => {
    params.push(value)
    where.push(`${col} = $${params.length}`)
  }

  if (filter.eventId) eq('event_id', filter.eventId)
  if (filter.bandId) eq('band_id', filter.bandId)
  if (filter.platform) eq('platform', filter.platform)
  if (filter.groupKey) eq('group_key', filter.groupKey)
  if (filter.status) eq('status', filter.status)
  if (filter.since) {
    params.push(filter.since)
    where.push(
      `COALESCE(posted_at, scheduled_for) >= $${params.length}::timestamptz`
    )
  }
  params.push(filter.limit ?? 200)

  const text = `
    SELECT * FROM posts
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY COALESCE(posted_at, scheduled_for) DESC NULLS LAST, group_key, platform
    LIMIT $${params.length}
  `
  const { rows } = await sqlQuery<Post>(text, params)
  return rows
}

/** Every post in one cross-platform burst, in a stable platform order. */
export async function listPostsByGroup(groupKey: string): Promise<Post[]> {
  const { rows } = await sqlQuery<Post>(
    `SELECT * FROM posts
     WHERE group_key = $1
     ORDER BY array_position(
       ARRAY['youtube','linkedin','facebook','instagram','tiktok','threads'],
       platform::text
     ), posted_at`,
    [groupKey]
  )
  return rows
}
