import { NextRequest, NextResponse } from 'next/server'
import {
  getVideographers,
  getVideographerBySlug,
  setVideographerEvents,
} from '@/lib/db'
import { sql } from '@/lib/sql'
import {
  withPublicRateLimit,
  withAdminProtection,
  withErrorHandling,
  ProtectedApiHandler,
} from '@/lib/api-protection'
import { nameToSlug } from '@/lib/slug-utils'
import { parseBody, videographerCreateSchema } from '@/lib/api-schemas'

export const GET = withErrorHandling(
  'fetch videographers',
  withPublicRateLimit(async function GET() {
    const videographers = await getVideographers()
    return NextResponse.json(videographers)
  })
)

const handleCreateVideographer: ProtectedApiHandler = async (
  request: NextRequest
) => {
  const parsed = await parseBody(request, videographerCreateSchema)
  if (!parsed.ok) return parsed.response

  const { name, bio, location, website, instagram, email, avatar_url } =
    parsed.data
  const slug = parsed.data.slug || nameToSlug(name)

  const existing = await getVideographerBySlug(slug)
  if (existing) {
    return NextResponse.json(
      { error: `Videographer with slug "${slug}" already exists` },
      { status: 409 }
    )
  }

  const { rows } = await sql`
    INSERT INTO videographers (slug, name, bio, location, website, instagram, email, avatar_url)
    VALUES (${slug}, ${name}, ${bio || null}, ${location || null}, ${website || null}, ${instagram || null}, ${email || null}, ${avatar_url || null})
    RETURNING *
  `

  if (parsed.data.event_ids) {
    await setVideographerEvents(slug, parsed.data.event_ids)
  }

  return NextResponse.json({ videographer: rows[0] }, { status: 201 })
}

export const POST = withErrorHandling(
  'create videographer',
  withAdminProtection(handleCreateVideographer)
)
