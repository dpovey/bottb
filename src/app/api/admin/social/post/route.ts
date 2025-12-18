/**
 * Social Post API
 *
 * POST /api/admin/social/post - Create and publish a post to selected platforms
 *
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createSocialPost,
  createSocialPostResult,
  updateSocialPostStatus,
  getSocialAccountWithTokens,
} from "@/lib/social/db";
import { getPhotoById } from "@/lib/db";
import { postToLinkedIn } from "@/lib/social/linkedin";
import {
  postToFacebookPage,
  postMultipleToFacebookPage,
  postToInstagram,
  postCarouselToInstagram,
} from "@/lib/social/meta";
import type { SocialPlatform, CreateSocialPostInput } from "@/lib/social/types";
import { getBaseUrl } from "@/lib/social/linkedin";

interface PostRequestBody {
  platforms: SocialPlatform[];
  title?: string;
  caption: string;
  photo_ids: string[];
  event_id?: string;
  band_id?: string;
  template_id?: string;
  include_photographer_credit?: boolean;
  include_event_link?: boolean;
  hashtags?: string[];
  ig_collaborator_handles?: string[];
  ig_crop_info?: Record<string, { x: number; y: number; width: number; height: number }>;
}

export async function POST(request: NextRequest) {
  // Check admin auth
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: PostRequestBody = await request.json();

    // Validate required fields
    if (!body.platforms || body.platforms.length === 0) {
      return NextResponse.json(
        { error: "At least one platform is required" },
        { status: 400 }
      );
    }

    if (!body.photo_ids || body.photo_ids.length === 0) {
      return NextResponse.json(
        { error: "At least one photo is required" },
        { status: 400 }
      );
    }

    if (!body.caption) {
      return NextResponse.json(
        { error: "Caption is required" },
        { status: 400 }
      );
    }

    // Create post record
    const postInput: CreateSocialPostInput = {
      platforms: body.platforms,
      title: body.title,
      caption: body.caption,
      photo_ids: body.photo_ids,
      event_id: body.event_id,
      band_id: body.band_id,
      template_id: body.template_id,
      include_photographer_credit: body.include_photographer_credit,
      include_event_link: body.include_event_link,
      hashtags: body.hashtags,
      ig_collaborator_handles: body.ig_collaborator_handles,
      ig_crop_info: body.ig_crop_info,
      created_by: session.user.email || session.user.id,
    };

    const post = await createSocialPost(postInput);

    // Update status to processing
    await updateSocialPostStatus(post.id, "processing");

    // Fetch photo URLs - we need both original WebP URLs and JPEG URLs for Instagram
    const photoIds: string[] = [];
    const photoUrls: string[] = []; // Original blob URLs (WebP) for Facebook/LinkedIn
    const jpegUrls: string[] = []; // Converted JPEG URLs for Instagram

    const baseUrl = getBaseUrl();

    for (const photoId of body.photo_ids) {
      const photo = await getPhotoById(photoId);
      if (photo) {
        photoIds.push(photoId);
        photoUrls.push(photo.blob_url);
        // Instagram requires JPEG - use our conversion endpoint
        jpegUrls.push(`${baseUrl}/api/photos/${photoId}/jpeg?quality=95`);
      }
    }

    if (photoUrls.length === 0) {
      await updateSocialPostStatus(post.id, "failed");
      return NextResponse.json(
        { error: "No valid photos found" },
        { status: 400 }
      );
    }

    // Post to each platform
    const results: Record<string, { success: boolean; postUrl?: string; error?: string }> = {};
    let hasSuccess = false;
    let hasFailure = false;

    for (const platform of body.platforms) {
      try {
        if (platform === "linkedin") {
          const account = await getSocialAccountWithTokens("linkedin");

          if (!account || account.status !== "active") {
            throw new Error("LinkedIn account not connected or inactive");
          }

          if (!account.organization_urn) {
            throw new Error("LinkedIn organization not configured");
          }

          const result = await postToLinkedIn(
            account.access_token,
            account.organization_urn,
            {
              caption: body.caption,
              title: body.title,
              photoUrls,
            }
          );

          await createSocialPostResult({
            post_id: post.id,
            platform: "linkedin",
            status: "success",
            external_post_id: result.postId,
            external_post_url: result.postUrl,
          });

          results.linkedin = { success: true, postUrl: result.postUrl };
          hasSuccess = true;
        } else if (platform === "facebook") {
          const account = await getSocialAccountWithTokens("facebook");

          if (!account || account.status !== "active") {
            throw new Error("Facebook Page not connected or inactive");
          }

          let postId: string;

          if (photoUrls.length === 1) {
            // Single photo post
            const result = await postToFacebookPage(
              account.provider_account_id,
              account.access_token,
              photoUrls[0],
              body.caption
            );
            postId = result.id;
          } else {
            // Multi-photo post
            const result = await postMultipleToFacebookPage(
              account.provider_account_id,
              account.access_token,
              photoUrls,
              body.caption
            );
            postId = result.id;
          }

          const postUrl = `https://www.facebook.com/${postId}`;

          await createSocialPostResult({
            post_id: post.id,
            platform: "facebook",
            status: "success",
            external_post_id: postId,
            external_post_url: postUrl,
          });

          results.facebook = { success: true, postUrl };
          hasSuccess = true;
        } else if (platform === "instagram") {
          const account = await getSocialAccountWithTokens("instagram");

          if (!account || account.status !== "active") {
            throw new Error("Instagram account not connected or inactive");
          }

          // Build caption with optional collaborator mentions
          let caption = body.caption;
          if (body.ig_collaborator_handles && body.ig_collaborator_handles.length > 0) {
            const mentions = body.ig_collaborator_handles
              .map((h) => (h.startsWith("@") ? h : `@${h}`))
              .join(" ");
            caption = `${caption}\n\n📸 ${mentions}`;
          }

          let postId: string;

          // Use JPEG URLs for Instagram (requires JPEG format)
          if (jpegUrls.length === 1) {
            // Single photo post
            const result = await postToInstagram(
              account.provider_account_id,
              account.access_token,
              jpegUrls[0],
              caption
            );
            postId = result.id;
          } else {
            // Carousel post (2-10 photos)
            const result = await postCarouselToInstagram(
              account.provider_account_id,
              account.access_token,
              jpegUrls,
              caption
            );
            postId = result.id;
          }

          // Note: Instagram doesn't provide direct post URLs via API
          // The post ID can be used to construct a URL but it's not always reliable
          const postUrl = `https://www.instagram.com/p/${postId}/`;

          await createSocialPostResult({
            post_id: post.id,
            platform: "instagram",
            status: "success",
            external_post_id: postId,
            external_post_url: postUrl,
          });

          results.instagram = { success: true, postUrl };
          hasSuccess = true;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        await createSocialPostResult({
          post_id: post.id,
          platform,
          status: "failed",
          error_message: errorMessage,
        });

        results[platform] = { success: false, error: errorMessage };
        hasFailure = true;
      }
    }

    // Update overall post status
    let finalStatus: "completed" | "partial" | "failed";
    if (hasSuccess && !hasFailure) {
      finalStatus = "completed";
    } else if (hasSuccess && hasFailure) {
      finalStatus = "partial";
    } else {
      finalStatus = "failed";
    }

    await updateSocialPostStatus(post.id, finalStatus);

    return NextResponse.json({
      post_id: post.id,
      status: finalStatus,
      results,
    });
  } catch (error) {
    console.error("Social post error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Post failed" },
      { status: 500 }
    );
  }
}

