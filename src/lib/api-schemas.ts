import { z } from 'zod'
import { NextResponse } from 'next/server'

/**
 * Shared Zod helpers for validating API route request bodies.
 *
 * Each route declares a schema and calls `parseBody(request, schema)` at the
 * top of its handler. On success: returns parsed data. On failure: returns
 * a `NextResponse` with `{ error, details }` and 400 — caller short-circuits
 * with `return result.response`.
 */

export type ParsedBody<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse }

export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<ParsedBody<z.infer<T>>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      ),
    }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }))
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid request body', details: issues },
        { status: 400 }
      ),
    }
  }

  return { ok: true, data: result.data }
}

/* ---------------------------------------------------------------------------
 * Common building blocks
 * ------------------------------------------------------------------------- */

const trimmedString = (label: string, max = 200) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} exceeds ${max} characters`)

const slugString = z
  .string()
  .trim()
  .max(120)
  .regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, numbers, and hyphens')
  .optional()

const optionalUrl = z
  .union([
    z.string().trim().max(2000).url('must be a valid URL'),
    z.literal(''),
    z.null(),
  ])
  .optional()
  .transform((v) => (v === '' ? null : v))

const optionalText = (max = 2000) =>
  z.string().trim().max(max).optional().nullable()

/* ---------------------------------------------------------------------------
 * Specific route schemas
 * ------------------------------------------------------------------------- */

export const photographerCreateSchema = z.object({
  slug: slugString,
  name: trimmedString('name', 120),
  bio: optionalText(2000),
  location: optionalText(120),
  website: optionalUrl,
  instagram: optionalText(60),
  email: optionalText(120),
  avatar_url: optionalUrl,
})
export type PhotographerCreateBody = z.infer<typeof photographerCreateSchema>

export const companyCreateSchema = z.object({
  slug: slugString,
  name: trimmedString('name', 120),
  logo_url: optionalUrl,
  website: optionalUrl,
  icon_url: optionalUrl,
})
export type CompanyCreateBody = z.infer<typeof companyCreateSchema>

/**
 * Pre-staged for broader rollout — not yet wired into a route in this PR.
 */
export const bandCreateSchema = z.object({
  event_id: trimmedString('event_id', 64),
  name: trimmedString('name', 120),
  slug: slugString,
  company: optionalText(120),
  performance_order: z.number().int().min(0).max(100).optional(),
  description: optionalText(4000),
  hero_url: optionalUrl,
  logo_url: optionalUrl,
})
export type BandCreateBody = z.infer<typeof bandCreateSchema>

export const youtubeImportSchema = z.object({
  videos: z
    .array(
      z.object({
        videoId: trimmedString('videoId', 64),
        title: trimmedString('title', 500),
        eventId: z.string().trim().max(64).optional().nullable(),
        bandId: z.string().trim().max(64).optional().nullable(),
        isShort: z.boolean().optional(),
      })
    )
    .min(1, 'No videos to import')
    .max(100, 'Cannot import more than 100 videos at once'),
})
export type YoutubeImportBody = z.infer<typeof youtubeImportSchema>
