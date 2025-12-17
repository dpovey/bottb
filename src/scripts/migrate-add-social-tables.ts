/**
 * Migration: Add social sharing tables
 *
 * Creates tables for:
 * - social_accounts: OAuth connections (LinkedIn, Meta/Facebook/Instagram)
 * - social_post_templates: Reusable post templates
 * - social_posts: Post requests with photo references
 * - social_post_results: Per-platform results for each post
 */

import { sql } from "@vercel/postgres";

async function migrate() {
  console.log("🚀 Starting migration: Add social sharing tables...\n");

  try {
    // 1. social_accounts - stores OAuth tokens (encrypted) and account info
    console.log("Creating social_accounts table...");
    await sql`
      CREATE TABLE IF NOT EXISTS social_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- Provider info
        provider VARCHAR(50) NOT NULL CHECK (provider IN ('linkedin', 'meta')),
        provider_account_id VARCHAR(255) NOT NULL,
        provider_account_name VARCHAR(255),
        
        -- For LinkedIn: organization URN; For Meta: page_id + ig_business_id
        organization_urn VARCHAR(255),
        page_id VARCHAR(255),
        ig_business_account_id VARCHAR(255),
        
        -- Encrypted OAuth tokens (AES-256-GCM encrypted, base64 encoded)
        access_token_encrypted TEXT NOT NULL,
        refresh_token_encrypted TEXT,
        
        -- Token expiry
        access_token_expires_at TIMESTAMP WITH TIME ZONE,
        refresh_token_expires_at TIMESTAMP WITH TIME ZONE,
        
        -- OAuth scopes granted
        scopes TEXT[],
        
        -- Account status
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'error')),
        last_error TEXT,
        
        -- Metadata
        connected_by VARCHAR(255),
        connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        -- One account per provider
        UNIQUE(provider)
      )
    `;
    console.log("✅ social_accounts table created\n");

    // 2. social_post_templates - reusable templates
    console.log("Creating social_post_templates table...");
    await sql`
      CREATE TABLE IF NOT EXISTS social_post_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- Template info
        name VARCHAR(255) NOT NULL,
        description TEXT,
        
        -- Template content with placeholders like {band}, {event}, {photographer}
        title_template TEXT,
        caption_template TEXT,
        
        -- Default settings
        include_photographer_credit BOOLEAN DEFAULT true,
        include_event_link BOOLEAN DEFAULT true,
        default_hashtags TEXT[],
        
        -- Ordering
        sort_order INTEGER DEFAULT 0,
        
        -- Timestamps
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log("✅ social_post_templates table created\n");

    // 3. social_posts - the actual post requests
    console.log("Creating social_posts table...");
    await sql`
      CREATE TABLE IF NOT EXISTS social_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- Target platforms (array of providers to post to)
        platforms TEXT[] NOT NULL,
        
        -- Content
        title TEXT,
        caption TEXT NOT NULL,
        
        -- Photo references (array of photo IDs)
        photo_ids UUID[] NOT NULL,
        
        -- Context (for AI suggestions and auditing)
        event_id VARCHAR(255) REFERENCES events(id) ON DELETE SET NULL,
        band_id VARCHAR(255) REFERENCES bands(id) ON DELETE SET NULL,
        
        -- Template used (if any)
        template_id UUID REFERENCES social_post_templates(id) ON DELETE SET NULL,
        
        -- Settings
        include_photographer_credit BOOLEAN DEFAULT true,
        include_event_link BOOLEAN DEFAULT true,
        hashtags TEXT[],
        
        -- Instagram-specific: photographer handles for @mentions
        ig_collaborator_handles TEXT[],
        
        -- For multi-photo Instagram: crop rectangles per photo (JSON)
        -- Format: { "photo_id": { "x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100 } }
        ig_crop_info JSONB DEFAULT '{}',
        
        -- Overall status
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'partial', 'failed')),
        
        -- Who created this post
        created_by VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log("✅ social_posts table created\n");

    // 4. social_post_results - per-platform results
    console.log("Creating social_post_results table...");
    await sql`
      CREATE TABLE IF NOT EXISTS social_post_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- Parent post
        post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
        
        -- Platform
        platform VARCHAR(50) NOT NULL CHECK (platform IN ('linkedin', 'facebook', 'instagram')),
        
        -- Result
        status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
        
        -- External post ID/URL (if successful)
        external_post_id VARCHAR(255),
        external_post_url TEXT,
        
        -- Error info (if failed)
        error_code VARCHAR(100),
        error_message TEXT,
        
        -- Response data (full API response for debugging)
        response_data JSONB,
        
        -- Timestamps
        attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        -- One result per platform per post
        UNIQUE(post_id, platform)
      )
    `;
    console.log("✅ social_post_results table created\n");

    // Create indexes
    console.log("Creating indexes...");
    await sql`CREATE INDEX IF NOT EXISTS idx_social_accounts_provider ON social_accounts(provider)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_social_accounts_status ON social_accounts(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_social_post_templates_sort ON social_post_templates(sort_order)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_social_posts_event ON social_posts(event_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_social_posts_created ON social_posts(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_social_post_results_post ON social_post_results(post_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_social_post_results_platform ON social_post_results(platform)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_social_post_results_status ON social_post_results(status)`;
    console.log("✅ Indexes created\n");

    // Seed default templates
    console.log("Seeding default templates...");
    await sql`
      INSERT INTO social_post_templates (name, description, title_template, caption_template, include_photographer_credit, include_event_link, default_hashtags, sort_order)
      VALUES 
        (
          'Photo only',
          'Posts photo with no text caption',
          NULL,
          '',
          false,
          false,
          ARRAY[]::TEXT[],
          0
        ),
        (
          'Standard show recap',
          'Standard template for sharing event photos',
          '{band} at {event}',
          '{band} bringing the energy at {event}! 🎸🔥

📸 {photographer}',
          true,
          true,
          ARRAY['#BattleOfTheTechBands', '#BOTTB', '#LiveMusic', '#CorporateBands']::TEXT[],
          1
        ),
        (
          'Winner highlight',
          'Template for announcing winners',
          'Congratulations {band}! 🏆',
          'Congratulations to {band} for their incredible performance at {event}! 🏆🎉

They absolutely crushed it on stage!

📸 {photographer}',
          true,
          true,
          ARRAY['#BattleOfTheTechBands', '#BOTTB', '#Winners', '#LiveMusic']::TEXT[],
          2
        )
      ON CONFLICT DO NOTHING
    `;
    console.log("✅ Default templates seeded\n");

    console.log("🎉 Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

migrate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

