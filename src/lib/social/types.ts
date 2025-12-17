/**
 * Types for social sharing functionality
 */

// Supported platforms
export type SocialProvider = "linkedin" | "meta";
export type SocialPlatform = "linkedin" | "facebook" | "instagram";

// Account status
export type SocialAccountStatus = "active" | "expired" | "revoked" | "error";

// Post status
export type SocialPostStatus =
  | "pending"
  | "processing"
  | "completed"
  | "partial"
  | "failed";
export type SocialPostResultStatus = "pending" | "success" | "failed";

/**
 * Social account (OAuth connection)
 */
export interface SocialAccount {
  id: string;
  provider: SocialProvider;
  provider_account_id: string;
  provider_account_name: string | null;

  // LinkedIn-specific
  organization_urn: string | null;

  // Meta-specific (Facebook + Instagram)
  page_id: string | null;
  ig_business_account_id: string | null;

  // Token expiry (tokens themselves are encrypted in DB)
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;

  scopes: string[];
  status: SocialAccountStatus;
  last_error: string | null;

  connected_by: string | null;
  connected_at: string;
  updated_at: string;
}

/**
 * Social account with decrypted tokens (internal use only)
 */
export interface SocialAccountWithTokens extends SocialAccount {
  access_token: string;
  refresh_token: string | null;
}

/**
 * Post template
 */
export interface SocialPostTemplate {
  id: string;
  name: string;
  description: string | null;
  title_template: string | null;
  caption_template: string | null;
  include_photographer_credit: boolean;
  include_event_link: boolean;
  default_hashtags: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Social post
 */
export interface SocialPost {
  id: string;
  platforms: SocialPlatform[];
  title: string | null;
  caption: string;
  photo_ids: string[];

  event_id: string | null;
  band_id: string | null;
  template_id: string | null;

  include_photographer_credit: boolean;
  include_event_link: boolean;
  hashtags: string[];

  ig_collaborator_handles: string[];
  ig_crop_info: Record<string, CropRectangle>;

  status: SocialPostStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  event_name?: string;
  band_name?: string;
  template_name?: string;
}

/**
 * Post result per platform
 */
export interface SocialPostResult {
  id: string;
  post_id: string;
  platform: SocialPlatform;
  status: SocialPostResultStatus;

  external_post_id: string | null;
  external_post_url: string | null;

  error_code: string | null;
  error_message: string | null;
  response_data: Record<string, unknown> | null;

  attempted_at: string;
}

/**
 * Full post with results
 */
export interface SocialPostWithResults extends SocialPost {
  results: SocialPostResult[];
}

/**
 * Crop rectangle (percentages 0-100)
 */
export interface CropRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Input for creating a new post
 */
export interface CreateSocialPostInput {
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
  ig_crop_info?: Record<string, CropRectangle>;

  created_by?: string;
}

/**
 * Input for connecting a social account
 */
export interface ConnectSocialAccountInput {
  provider: SocialProvider;
  provider_account_id: string;
  provider_account_name?: string;

  // LinkedIn
  organization_urn?: string;

  // Meta
  page_id?: string;
  ig_business_account_id?: string;

  // Tokens (will be encrypted before storage)
  access_token: string;
  refresh_token?: string;

  access_token_expires_at?: Date;
  refresh_token_expires_at?: Date;

  scopes?: string[];
  connected_by?: string;
}

/**
 * Context for AI caption generation
 */
export interface CaptionContext {
  event_name?: string;
  event_date?: string;
  event_location?: string;
  band_name?: string;
  band_description?: string;
  company_name?: string;
  photographer_name?: string;
  setlist_songs?: string[];
  photo_count: number;
}

