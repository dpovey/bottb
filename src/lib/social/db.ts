/**
 * Database helpers for social sharing functionality
 */

import { sql } from "@vercel/postgres";
import { encryptToken, decryptToken } from "./encryption";
import type {
  SocialAccount,
  SocialAccountWithTokens,
  SocialPostTemplate,
  SocialPost,
  SocialPostResult,
  SocialPostWithResults,
  SocialProvider,
  SocialPlatform,
  SocialPostStatus,
  SocialPostResultStatus,
  CreateSocialPostInput,
  ConnectSocialAccountInput,
} from "./types";

// ============================================================================
// Social Accounts
// ============================================================================

/**
 * Get all connected social accounts
 */
export async function getSocialAccounts(): Promise<SocialAccount[]> {
  const { rows } = await sql<SocialAccount>`
    SELECT 
      id, provider, provider_account_id, provider_account_name,
      organization_urn, page_id, ig_business_account_id,
      access_token_expires_at, refresh_token_expires_at,
      scopes, status, last_error,
      connected_by, connected_at, updated_at
    FROM social_accounts
    ORDER BY provider
  `;
  return rows;
}

/**
 * Get a specific social account by provider
 */
export async function getSocialAccountByProvider(
  provider: SocialProvider
): Promise<SocialAccount | null> {
  const { rows } = await sql<SocialAccount>`
    SELECT 
      id, provider, provider_account_id, provider_account_name,
      organization_urn, page_id, ig_business_account_id,
      access_token_expires_at, refresh_token_expires_at,
      scopes, status, last_error,
      connected_by, connected_at, updated_at
    FROM social_accounts
    WHERE provider = ${provider}
  `;
  return rows[0] || null;
}

/**
 * Get a social account with decrypted tokens (for API calls)
 */
export async function getSocialAccountWithTokens(
  provider: SocialProvider
): Promise<SocialAccountWithTokens | null> {
  const { rows } = await sql<
    SocialAccount & {
      access_token_encrypted: string;
      refresh_token_encrypted: string | null;
    }
  >`
    SELECT *
    FROM social_accounts
    WHERE provider = ${provider}
  `;

  if (!rows[0]) return null;

  const account = rows[0];
  return {
    ...account,
    access_token: decryptToken(account.access_token_encrypted),
    refresh_token: account.refresh_token_encrypted
      ? decryptToken(account.refresh_token_encrypted)
      : null,
  };
}

/**
 * Connect or update a social account
 */
export async function connectSocialAccount(
  input: ConnectSocialAccountInput
): Promise<SocialAccount> {
  const accessTokenEncrypted = encryptToken(input.access_token);
  const refreshTokenEncrypted = input.refresh_token
    ? encryptToken(input.refresh_token)
    : null;

  // Convert scopes array to PostgreSQL array literal
  const scopesLiteral = `{${(input.scopes || []).join(",")}}`;

  const { rows } = await sql<SocialAccount>`
    INSERT INTO social_accounts (
      provider, provider_account_id, provider_account_name,
      organization_urn, page_id, ig_business_account_id,
      access_token_encrypted, refresh_token_encrypted,
      access_token_expires_at, refresh_token_expires_at,
      scopes, status, connected_by
    ) VALUES (
      ${input.provider},
      ${input.provider_account_id},
      ${input.provider_account_name || null},
      ${input.organization_urn || null},
      ${input.page_id || null},
      ${input.ig_business_account_id || null},
      ${accessTokenEncrypted},
      ${refreshTokenEncrypted},
      ${input.access_token_expires_at?.toISOString() || null},
      ${input.refresh_token_expires_at?.toISOString() || null},
      ${scopesLiteral}::text[],
      'active',
      ${input.connected_by || null}
    )
    ON CONFLICT (provider) DO UPDATE SET
      provider_account_id = EXCLUDED.provider_account_id,
      provider_account_name = EXCLUDED.provider_account_name,
      organization_urn = EXCLUDED.organization_urn,
      page_id = EXCLUDED.page_id,
      ig_business_account_id = EXCLUDED.ig_business_account_id,
      access_token_encrypted = EXCLUDED.access_token_encrypted,
      refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
      access_token_expires_at = EXCLUDED.access_token_expires_at,
      refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
      scopes = EXCLUDED.scopes,
      status = 'active',
      last_error = NULL,
      connected_by = EXCLUDED.connected_by,
      updated_at = NOW()
    RETURNING 
      id, provider, provider_account_id, provider_account_name,
      organization_urn, page_id, ig_business_account_id,
      access_token_expires_at, refresh_token_expires_at,
      scopes, status, last_error,
      connected_by, connected_at, updated_at
  `;

  return rows[0];
}

/**
 * Update tokens for a social account (e.g., after refresh)
 */
export async function updateSocialAccountTokens(
  provider: SocialProvider,
  accessToken: string,
  refreshToken?: string,
  accessTokenExpiresAt?: Date,
  refreshTokenExpiresAt?: Date
): Promise<void> {
  const accessTokenEncrypted = encryptToken(accessToken);
  const refreshTokenEncrypted = refreshToken
    ? encryptToken(refreshToken)
    : null;

  await sql`
    UPDATE social_accounts
    SET 
      access_token_encrypted = ${accessTokenEncrypted},
      refresh_token_encrypted = COALESCE(${refreshTokenEncrypted}, refresh_token_encrypted),
      access_token_expires_at = ${accessTokenExpiresAt?.toISOString() || null},
      refresh_token_expires_at = COALESCE(${refreshTokenExpiresAt?.toISOString() || null}, refresh_token_expires_at),
      status = 'active',
      last_error = NULL,
      updated_at = NOW()
    WHERE provider = ${provider}
  `;
}

/**
 * Update account status (e.g., mark as expired or error)
 */
export async function updateSocialAccountStatus(
  provider: SocialProvider,
  status: "active" | "expired" | "revoked" | "error",
  errorMessage?: string
): Promise<void> {
  await sql`
    UPDATE social_accounts
    SET 
      status = ${status},
      last_error = ${errorMessage || null},
      updated_at = NOW()
    WHERE provider = ${provider}
  `;
}

/**
 * Disconnect (delete) a social account
 */
export async function disconnectSocialAccount(
  provider: SocialProvider
): Promise<void> {
  await sql`DELETE FROM social_accounts WHERE provider = ${provider}`;
}

// ============================================================================
// Post Templates
// ============================================================================

/**
 * Get all post templates
 */
export async function getSocialPostTemplates(): Promise<SocialPostTemplate[]> {
  const { rows } = await sql<SocialPostTemplate>`
    SELECT *
    FROM social_post_templates
    ORDER BY sort_order, name
  `;
  return rows;
}

/**
 * Get a template by ID
 */
export async function getSocialPostTemplateById(
  id: string
): Promise<SocialPostTemplate | null> {
  const { rows } = await sql<SocialPostTemplate>`
    SELECT * FROM social_post_templates WHERE id = ${id}
  `;
  return rows[0] || null;
}

/**
 * Create a new template
 */
export async function createSocialPostTemplate(input: {
  name: string;
  description?: string;
  title_template?: string;
  caption_template?: string;
  include_photographer_credit?: boolean;
  include_event_link?: boolean;
  default_hashtags?: string[];
}): Promise<SocialPostTemplate> {
  // Convert hashtags array to PostgreSQL array literal
  const hashtagsLiteral = `{${(input.default_hashtags || []).join(",")}}`;

  const { rows } = await sql<SocialPostTemplate>`
    INSERT INTO social_post_templates (
      name, description, title_template, caption_template,
      include_photographer_credit, include_event_link, default_hashtags
    ) VALUES (
      ${input.name},
      ${input.description || null},
      ${input.title_template || null},
      ${input.caption_template || null},
      ${input.include_photographer_credit ?? true},
      ${input.include_event_link ?? true},
      ${hashtagsLiteral}::text[]
    )
    RETURNING *
  `;
  return rows[0];
}

/**
 * Update a template
 */
export async function updateSocialPostTemplate(
  id: string,
  input: Partial<{
    name: string;
    description: string;
    title_template: string;
    caption_template: string;
    include_photographer_credit: boolean;
    include_event_link: boolean;
    default_hashtags: string[];
    sort_order: number;
  }>
): Promise<SocialPostTemplate | null> {
  // Build dynamic update - only update provided fields
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(input.name);
  }
  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(input.description);
  }
  if (input.title_template !== undefined) {
    updates.push(`title_template = $${paramIndex++}`);
    values.push(input.title_template);
  }
  if (input.caption_template !== undefined) {
    updates.push(`caption_template = $${paramIndex++}`);
    values.push(input.caption_template);
  }
  if (input.include_photographer_credit !== undefined) {
    updates.push(`include_photographer_credit = $${paramIndex++}`);
    values.push(input.include_photographer_credit);
  }
  if (input.include_event_link !== undefined) {
    updates.push(`include_event_link = $${paramIndex++}`);
    values.push(input.include_event_link);
  }
  if (input.default_hashtags !== undefined) {
    updates.push(`default_hashtags = $${paramIndex++}`);
    values.push(input.default_hashtags);
  }
  if (input.sort_order !== undefined) {
    updates.push(`sort_order = $${paramIndex++}`);
    values.push(input.sort_order);
  }

  if (updates.length === 0) {
    return getSocialPostTemplateById(id);
  }

  updates.push(`updated_at = NOW()`);
  values.push(id);

  const { rows } = await sql.query<SocialPostTemplate>(
    `UPDATE social_post_templates SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return rows[0] || null;
}

/**
 * Delete a template
 */
export async function deleteSocialPostTemplate(id: string): Promise<void> {
  await sql`DELETE FROM social_post_templates WHERE id = ${id}`;
}

// ============================================================================
// Social Posts
// ============================================================================

/**
 * Create a new social post
 */
export async function createSocialPost(
  input: CreateSocialPostInput
): Promise<SocialPost> {
  // Convert arrays to PostgreSQL array literals
  const platformsLiteral = `{${input.platforms.join(",")}}`;
  const photoIdsLiteral = `{${input.photo_ids.join(",")}}`;
  const hashtagsLiteral = `{${(input.hashtags || []).join(",")}}`;
  const igHandlesLiteral = `{${(input.ig_collaborator_handles || []).join(",")}}`;

  const { rows } = await sql<SocialPost>`
    INSERT INTO social_posts (
      platforms, title, caption, photo_ids,
      event_id, band_id, template_id,
      include_photographer_credit, include_event_link, hashtags,
      ig_collaborator_handles, ig_crop_info,
      created_by
    ) VALUES (
      ${platformsLiteral}::text[],
      ${input.title || null},
      ${input.caption},
      ${photoIdsLiteral}::uuid[],
      ${input.event_id || null},
      ${input.band_id || null},
      ${input.template_id || null},
      ${input.include_photographer_credit ?? true},
      ${input.include_event_link ?? true},
      ${hashtagsLiteral}::text[],
      ${igHandlesLiteral}::text[],
      ${JSON.stringify(input.ig_crop_info || {})}::jsonb,
      ${input.created_by || null}
    )
    RETURNING *
  `;
  return rows[0];
}

/**
 * Get a social post by ID with its results
 */
export async function getSocialPostById(
  id: string
): Promise<SocialPostWithResults | null> {
  const { rows: postRows } = await sql<SocialPost>`
    SELECT p.*, 
           e.name as event_name, 
           b.name as band_name,
           t.name as template_name
    FROM social_posts p
    LEFT JOIN events e ON p.event_id = e.id
    LEFT JOIN bands b ON p.band_id = b.id
    LEFT JOIN social_post_templates t ON p.template_id = t.id
    WHERE p.id = ${id}
  `;

  if (!postRows[0]) return null;

  const { rows: resultRows } = await sql<SocialPostResult>`
    SELECT * FROM social_post_results WHERE post_id = ${id}
  `;

  return {
    ...postRows[0],
    results: resultRows,
  };
}

/**
 * Get recent social posts
 */
export async function getRecentSocialPosts(
  limit = 20
): Promise<SocialPostWithResults[]> {
  const { rows: postRows } = await sql<SocialPost>`
    SELECT p.*, 
           e.name as event_name, 
           b.name as band_name,
           t.name as template_name
    FROM social_posts p
    LEFT JOIN events e ON p.event_id = e.id
    LEFT JOIN bands b ON p.band_id = b.id
    LEFT JOIN social_post_templates t ON p.template_id = t.id
    ORDER BY p.created_at DESC
    LIMIT ${limit}
  `;

  if (postRows.length === 0) return [];

  // Get all results for these posts
  const postIds = postRows.map((p) => p.id);
  const postIdsLiteral = `{${postIds.join(",")}}`;
  const { rows: resultRows } = await sql<SocialPostResult>`
    SELECT * FROM social_post_results WHERE post_id = ANY(${postIdsLiteral}::uuid[])
  `;

  // Group results by post_id
  const resultsByPost = new Map<string, SocialPostResult[]>();
  for (const result of resultRows) {
    const existing = resultsByPost.get(result.post_id) || [];
    existing.push(result);
    resultsByPost.set(result.post_id, existing);
  }

  return postRows.map((post) => ({
    ...post,
    results: resultsByPost.get(post.id) || [],
  }));
}

/**
 * Update post status
 */
export async function updateSocialPostStatus(
  id: string,
  status: SocialPostStatus
): Promise<void> {
  await sql`
    UPDATE social_posts 
    SET status = ${status}, updated_at = NOW() 
    WHERE id = ${id}
  `;
}

// ============================================================================
// Post Results
// ============================================================================

/**
 * Record a post result for a platform
 */
export async function createSocialPostResult(input: {
  post_id: string;
  platform: SocialPlatform;
  status: SocialPostResultStatus;
  external_post_id?: string;
  external_post_url?: string;
  error_code?: string;
  error_message?: string;
  response_data?: Record<string, unknown>;
}): Promise<SocialPostResult> {
  const { rows } = await sql<SocialPostResult>`
    INSERT INTO social_post_results (
      post_id, platform, status,
      external_post_id, external_post_url,
      error_code, error_message, response_data
    ) VALUES (
      ${input.post_id}::uuid,
      ${input.platform},
      ${input.status},
      ${input.external_post_id || null},
      ${input.external_post_url || null},
      ${input.error_code || null},
      ${input.error_message || null},
      ${JSON.stringify(input.response_data || null)}::jsonb
    )
    ON CONFLICT (post_id, platform) DO UPDATE SET
      status = EXCLUDED.status,
      external_post_id = EXCLUDED.external_post_id,
      external_post_url = EXCLUDED.external_post_url,
      error_code = EXCLUDED.error_code,
      error_message = EXCLUDED.error_message,
      response_data = EXCLUDED.response_data,
      attempted_at = NOW()
    RETURNING *
  `;
  return rows[0];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Apply template placeholders to text
 */
export function applyTemplatePlaceholders(
  template: string,
  context: {
    band?: string;
    event?: string;
    date?: string;
    location?: string;
    photographer?: string;
    company?: string;
  }
): string {
  let result = template;
  if (context.band) result = result.replace(/{band}/g, context.band);
  if (context.event) result = result.replace(/{event}/g, context.event);
  if (context.date) result = result.replace(/{date}/g, context.date);
  if (context.location) result = result.replace(/{location}/g, context.location);
  if (context.photographer)
    result = result.replace(/{photographer}/g, context.photographer);
  if (context.company) result = result.replace(/{company}/g, context.company);
  return result;
}

/**
 * Check if Instagram is configured (has connected Instagram account)
 */
export async function isInstagramConfigured(): Promise<boolean> {
  const account = await getSocialAccountByProvider("instagram");
  return !!(account && account.status === "active");
}

/**
 * Check which platforms are available for posting
 */
export async function getAvailablePlatforms(): Promise<SocialPlatform[]> {
  const accounts = await getSocialAccounts();
  const platforms: SocialPlatform[] = [];

  for (const account of accounts) {
    if (account.status !== "active") continue;

    if (account.provider === "linkedin" && account.organization_urn) {
      platforms.push("linkedin");
    }

    if (account.provider === "facebook") {
      platforms.push("facebook");
    }

    if (account.provider === "instagram") {
      platforms.push("instagram");
    }
  }

  return platforms;
}

