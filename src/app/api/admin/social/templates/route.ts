/**
 * Social Post Templates API
 *
 * GET /api/admin/social/templates - List all templates
 * POST /api/admin/social/templates - Create a new template
 *
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getSocialPostTemplates,
  createSocialPostTemplate,
} from "@/lib/social/db";

export async function GET() {
  // Check admin auth
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const templates = await getSocialPostTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Check admin auth
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      );
    }

    const template = await createSocialPostTemplate({
      name: body.name,
      description: body.description,
      title_template: body.title_template,
      caption_template: body.caption_template,
      include_photographer_credit: body.include_photographer_credit,
      include_event_link: body.include_event_link,
      default_hashtags: body.default_hashtags,
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create template" },
      { status: 500 }
    );
  }
}

