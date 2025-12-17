#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";

// Load environment variables from .env.local
config({ path: ".env.local" });

// Map DATABASE_URL to POSTGRES_URL if needed (Vercel Postgres SDK expects POSTGRES_URL)
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL;
}
if (!process.env.POSTGRES_URL_NON_POOLING && process.env.DATABASE_URL_UNPOOLED) {
  process.env.POSTGRES_URL_NON_POOLING = process.env.DATABASE_URL_UNPOOLED;
}

async function addSetlistSongsTable() {
  try {
    console.log("🔄 Creating setlist_songs table...");

    // Create the setlist_songs table
    await sql`
      CREATE TABLE IF NOT EXISTS setlist_songs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        band_id VARCHAR(255) NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        song_type VARCHAR(50) NOT NULL DEFAULT 'cover' CHECK (song_type IN ('cover', 'mashup', 'medley', 'transition')),
        title VARCHAR(255) NOT NULL,
        artist VARCHAR(255) NOT NULL,
        additional_songs JSONB DEFAULT '[]',
        transition_to_title VARCHAR(255),
        transition_to_artist VARCHAR(255),
        youtube_video_id VARCHAR(50),
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'locked', 'conflict')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    console.log("📊 Creating indexes...");

    // Create indexes for efficient queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_setlist_songs_band_id 
      ON setlist_songs(band_id)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_setlist_songs_position 
      ON setlist_songs(position)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_setlist_songs_title 
      ON setlist_songs(title)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_setlist_songs_artist 
      ON setlist_songs(artist)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_setlist_songs_song_type 
      ON setlist_songs(song_type)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_setlist_songs_status 
      ON setlist_songs(status)
    `;

    console.log("✅ Migration completed successfully!");
    console.log("");
    console.log("📝 The setlist_songs table has been created with:");
    console.log("   - id: UUID primary key");
    console.log("   - band_id: Reference to bands table");
    console.log("   - position: Order of song in setlist");
    console.log("   - song_type: cover, mashup, medley, or transition");
    console.log("   - title, artist: Song info");
    console.log("   - additional_songs: JSONB array for mashups/medleys");
    console.log("   - transition_to_title/artist: For transition songs");
    console.log("   - youtube_video_id: Optional video link");
    console.log("   - status: pending, locked, or conflict");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

addSetlistSongsTable();

