#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function checkDatabaseSchema() {
  try {
    console.log("🔍 Checking database schema...");

    // Get all columns from the votes table
    const { rows } = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'votes' 
      ORDER BY ordinal_position
    `;

    console.log("📊 Current votes table columns:");
    console.log("=".repeat(80));
    rows.forEach((row) => {
      console.log(
        `${row.column_name.padEnd(25)} | ${row.data_type.padEnd(15)} | ${
          row.is_nullable
        }`
      );
    });
    console.log("=".repeat(80));
    console.log(`Total columns: ${rows.length}`);

    // Check for specific columns we need
    const requiredColumns = [
      "id",
      "event_id",
      "band_id",
      "voter_type",
      "song_choice",
      "performance",
      "crowd_vibe",
      "crowd_vote",
      "ip_address",
      "user_agent",
      "browser_name",
      "browser_version",
      "os_name",
      "os_version",
      "device_type",
      "screen_resolution",
      "timezone",
      "language",
      "google_click_id",
      "facebook_pixel_id",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "vote_fingerprint",
      "fingerprintjs_visitor_id",
      "fingerprintjs_confidence",
      "created_at",
    ];

    const existingColumns = rows.map((row) => row.column_name);
    const missingColumns = requiredColumns.filter(
      (col) => !existingColumns.includes(col)
    );

    if (missingColumns.length === 0) {
      console.log("✅ All required columns exist!");
    } else {
      console.log("❌ Missing columns:");
      missingColumns.forEach((col) => console.log(`  - ${col}`));
    }
  } catch (error) {
    console.error("❌ Error checking database schema:", error);
    process.exit(1);
  }
}

checkDatabaseSchema();
