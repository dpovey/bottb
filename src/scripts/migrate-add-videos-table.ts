#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function migrateAddVideosTable() {
  try {
    console.log("🔄 Adding videos table...");

    // Create the videos table
    await sql.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        youtube_video_id VARCHAR(20) NOT NULL UNIQUE,
        title VARCHAR(255) NOT NULL,
        event_id VARCHAR(255) REFERENCES events(id) ON DELETE SET NULL,
        band_id VARCHAR(255) REFERENCES bands(id) ON DELETE SET NULL,
        duration_seconds INTEGER,
        thumbnail_url TEXT,
        published_at TIMESTAMP WITH TIME ZONE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    console.log("✅ Videos table created!");

    // Create indexes
    console.log("🔄 Creating indexes...");

    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_videos_event_id ON videos(event_id)
    `);

    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_videos_band_id ON videos(band_id)
    `);

    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_videos_youtube_id ON videos(youtube_video_id)
    `);

    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_videos_sort_order ON videos(sort_order)
    `);

    console.log("✅ Indexes created successfully!");
    console.log("✅ Videos table migration complete!");
  } catch (error) {
    console.error("❌ Error creating videos table:", error);
    process.exit(1);
  }
}

migrateAddVideosTable();

