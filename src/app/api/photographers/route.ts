import { NextRequest, NextResponse } from 'next/server'
import { getPhotographers, getPhotographerBySlug } from '@/lib/db'
import { sql } from '@/lib/sql'
import {
  withPublicRateLimit,
  withAdminProtection,
  withErrorHandling,
  ProtectedApiHandler,
} from '@/lib/api-protection'
import { nameToSlug } from '@/lib/slug-utils'
import { parseBody, photographerCreateSchema } from '@/lib/api-schemas'

export const GET = withErrorHandling(
  'fetch photographers',
  withPublicRateLimit(async function GET() {
    const photographers = await getPhotographers()
    return NextResponse.json(photographers)
  })
)

const handleCreatePhotographer: ProtectedApiHandler = async (
  request: NextRequest
) => {
  const parsed = await parseBody(request, photographerCreateSchema)
  if (!parsed.ok) return parsed.response

  const { name, bio, location, website, instagram, email, avatar_url } =
    parsed.data
  const slug = parsed.data.slug || nameToSlug(name)

  const existing = await getPhotographerBySlug(slug)
  if (existing) {
    return NextResponse.json(
      { error: `Photographer with slug "${slug}" already exists` },
      { status: 409 }
    )
  }

  const { rows } = await sql`
    INSERT INTO photographers (slug, name, bio, location, website, instagram, email, avatar_url)
    VALUES (${slug}, ${name}, ${bio || null}, ${location || null}, ${website || null}, ${instagram || null}, ${email || null}, ${avatar_url || null})
    RETURNING *
  `

  return NextResponse.json({ photographer: rows[0] }, { status: 201 })
}

export const POST = withErrorHandling(
  'create photographer',
  withAdminProtection(handleCreatePhotographer)
)
