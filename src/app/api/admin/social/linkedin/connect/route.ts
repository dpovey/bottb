/**
 * LinkedIn OAuth Connect - Initiate OAuth flow
 *
 * GET /api/admin/social/linkedin/connect
 *
 * Redirects to LinkedIn's OAuth authorization page.
 * Admin-only endpoint.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLinkedInAuthUrl } from "@/lib/social/linkedin";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";

export async function GET() {
  // Check admin auth
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Generate state token for CSRF protection
    const state = randomBytes(32).toString("hex");

    // Store state in cookie for verification in callback
    const cookieStore = await cookies();
    cookieStore.set("linkedin_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    // Get LinkedIn auth URL and redirect
    const authUrl = getLinkedInAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("LinkedIn OAuth error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OAuth initialization failed" },
      { status: 500 }
    );
  }
}

