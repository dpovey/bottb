/**
 * Meta OAuth Callback - Handle OAuth response
 *
 * GET /api/admin/social/meta/callback
 *
 * Exchanges authorization code for tokens and stores them.
 * Creates accounts for both Facebook Page and Instagram Business Account if available.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import {
  exchangeMetaCode,
  getLongLivedToken,
  getMetaPages,
  getInstagramAccount,
} from "@/lib/social/meta";
import { getBaseUrl } from "@/lib/social/linkedin";
import { connectSocialAccount } from "@/lib/social/db";

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl();
  const redirectUrl = `${baseUrl}/admin/social`;

  // Check admin auth
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.redirect(`${redirectUrl}?error=unauthorized`);
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Check for OAuth error
    if (error) {
      console.error("Meta OAuth error:", error, errorDescription);
      return NextResponse.redirect(
        `${redirectUrl}?error=${encodeURIComponent(errorDescription || error)}`
      );
    }

    // Validate required params
    if (!code || !state) {
      return NextResponse.redirect(`${redirectUrl}?error=missing_params`);
    }

    // Verify state token
    const cookieStore = await cookies();
    const storedState = cookieStore.get("meta_oauth_state")?.value;

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(`${redirectUrl}?error=invalid_state`);
    }

    // Clear state cookie
    cookieStore.delete("meta_oauth_state");

    // Exchange code for short-lived token
    console.log("[Meta Callback] Exchanging code for token...");
    const shortLivedToken = await exchangeMetaCode(code);
    console.log("[Meta Callback] Got short-lived token");

    // Exchange for long-lived token (60 days)
    console.log("[Meta Callback] Exchanging for long-lived token...");
    const longLivedToken = await getLongLivedToken(shortLivedToken.access_token);
    console.log("[Meta Callback] Got long-lived token");

    // Get pages the user manages
    console.log("[Meta Callback] Fetching pages...");
    const pages = await getMetaPages(longLivedToken.access_token);
    console.log("[Meta Callback] Found", pages.length, "pages");

    if (pages.length === 0) {
      return NextResponse.redirect(
        `${redirectUrl}?error=no_pages&message=${encodeURIComponent(
          "No Facebook Pages found. You need to be an admin of a Facebook Page to post."
        )}`
      );
    }

    // Calculate token expiry (long-lived tokens last ~60 days)
    const accessTokenExpiresAt = longLivedToken.expires_in
      ? new Date(Date.now() + longLivedToken.expires_in * 1000)
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // Default 60 days

    // Store accounts for each page
    let connectedCount = 0;
    let igConnectedCount = 0;

    for (const page of pages) {
      // Store Facebook Page account
      // Page access tokens don't expire if obtained from long-lived user token
      await connectSocialAccount({
        provider: "facebook",
        provider_account_id: page.id,
        provider_account_name: page.name,
        access_token: page.access_token,
        // Page tokens from long-lived user tokens don't expire
        access_token_expires_at: undefined,
        scopes: [
          "pages_show_list",
          "pages_read_engagement",
          "pages_manage_posts",
        ],
        connected_by: session.user.email || session.user.id,
        metadata: {
          user_access_token: longLivedToken.access_token,
          user_token_expires_at: accessTokenExpiresAt.toISOString(),
        },
      });
      connectedCount++;

      // If page has Instagram Business Account, store that too
      if (page.instagram_business_account?.id) {
        try {
          const igAccount = await getInstagramAccount(
            page.instagram_business_account.id,
            page.access_token
          );

          await connectSocialAccount({
            provider: "instagram",
            provider_account_id: igAccount.id,
            provider_account_name: igAccount.username || igAccount.name || `IG ${igAccount.id}`,
            // Instagram uses the Page access token
            access_token: page.access_token,
            access_token_expires_at: undefined,
            scopes: ["instagram_basic", "instagram_content_publish"],
            connected_by: session.user.email || session.user.id,
            metadata: {
              facebook_page_id: page.id,
              facebook_page_name: page.name,
            },
          });
          igConnectedCount++;
        } catch (igError) {
          console.error(
            `Failed to connect Instagram for page ${page.name}:`,
            igError
          );
        }
      }
    }

    // Redirect back with success message
    const message =
      igConnectedCount > 0
        ? `Connected ${connectedCount} Facebook Page(s) and ${igConnectedCount} Instagram account(s)`
        : `Connected ${connectedCount} Facebook Page(s)`;

    return NextResponse.redirect(
      `${redirectUrl}?connected=meta&message=${encodeURIComponent(message)}`
    );
  } catch (error) {
    console.error("Meta callback error:", error);
    return NextResponse.redirect(
      `${redirectUrl}?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Connection failed"
      )}`
    );
  }
}

