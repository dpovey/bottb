/**
 * Social Post Templates API
 *
 * GET /api/admin/social/templates - List all templates
 * POST /api/admin/social/templates - Create a new template
 *
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminProtection, ProtectedApiHandler } from '@/lib/api-protection'
import {
  getSocialPostTemplates,
  createSocialPostTemplate,
} from '@/lib/social/db'

const handleGetTemplates: ProtectedApiHandler = async () => {
  try {
    const templates = await getSocialPostTemplates()
    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to fetch templates',
      },
      { status: 500 }
    )
  }
}

const handleCreateTemplate: ProtectedApiHandler = async (
  request: NextRequest
) => {
  try {
    const body = await request.json()

    if (!body.name) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      )
    }

    const template = await createSocialPostTemplate({
      name: body.name,
      description: body.description,
      title_template: body.title_template,
      caption_template: body.caption_template,
      include_photographer_credit: body.include_photographer_credit,
      include_event_link: body.include_event_link,
      default_hashtags: body.default_hashtags,
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to create template',
      },
      { status: 500 }
    )
  }
}

export const GET = withAdminProtection(handleGetTemplates)
export const POST = withAdminProtection(handleCreateTemplate)
