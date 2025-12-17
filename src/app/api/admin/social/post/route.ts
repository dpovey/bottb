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
import type { SocialPlatform, CreateSocialPostInput } from "@/lib/social/types";

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

    // Fetch photo URLs
    const photoUrls: string[] = [];
    for (const photoId of body.photo_ids) {
      const photo = await getPhotoById(photoId);
      if (photo) {
        photoUrls.push(photo.blob_url);
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
        } else if (platform === "facebook" || platform === "instagram") {
          // Meta platforms - to be implemented
          await createSocialPostResult({
            post_id: post.id,
            platform,
            status: "failed",
            error_code: "NOT_IMPLEMENTED",
            error_message: "Meta posting not yet implemented",
          });

          results[platform] = { success: false, error: "Not yet implemented" };
          hasFailure = true;
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

