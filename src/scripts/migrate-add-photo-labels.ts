#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";

// Load environment variables
config({ path: ".env.local" });

async function migrate() {
  console.log("🚀 Starting migration: Add labels column to photos table...\n");

  try {
    // Check if column already exists
    const { rows: columns } = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'photos' AND column_name = 'labels'
    `;

    if (columns.length > 0) {
      console.log("✅ Column 'labels' already exists. Skipping column creation.");
    } else {
      // Add labels column
      console.log("📝 Adding 'labels' column to photos table...");
      await sql`
        ALTER TABLE photos 
        ADD COLUMN labels TEXT[] DEFAULT '{}'
      `;
      console.log("✅ Column 'labels' added successfully.");
    }

    // Check if index already exists
    const { rows: indexes } = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'photos' AND indexname = 'idx_photos_labels'
    `;

    if (indexes.length > 0) {
      console.log("✅ Index 'idx_photos_labels' already exists. Skipping index creation.");
    } else {
      // Create GIN index for efficient array queries
      console.log("📝 Creating GIN index on 'labels' column...");
      await sql`
        CREATE INDEX idx_photos_labels ON photos USING GIN (labels)
      `;
      console.log("✅ GIN index created successfully.");
    }

    console.log("\n🎉 Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();



