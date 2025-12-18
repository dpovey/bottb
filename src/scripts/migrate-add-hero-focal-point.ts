#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";

// Load environment variables
config({ path: ".env.local" });

async function migrate() {
  console.log("🚀 Starting migration: Add hero_focal_point column to photos table...\n");

  try {
    // Check if column already exists
    const { rows: columns } = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'photos' AND column_name = 'hero_focal_point'
    `;

    if (columns.length > 0) {
      console.log("✅ Column 'hero_focal_point' already exists. Skipping.");
    } else {
      // Add hero_focal_point column (JSONB for storing {x: number, y: number})
      console.log("📝 Adding 'hero_focal_point' column to photos table...");
      await sql`
        ALTER TABLE photos 
        ADD COLUMN hero_focal_point JSONB DEFAULT '{"x": 50, "y": 50}'
      `;
      console.log("✅ Column 'hero_focal_point' added successfully.");
      console.log("   Default focal point is center (50%, 50%)");
    }

    console.log("\n🎉 Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();




