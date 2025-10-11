#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function migrateAddStatus() {
  try {
    console.log("Adding status column to events table...");
    
    // Add the status column with default value
    await sql`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'upcoming' 
      CHECK (status IN ('upcoming', 'voting', 'finalized'))
    `;
    
    // Update existing events based on their current state
    // If is_active is true, set status to 'voting'
    await sql`
      UPDATE events 
      SET status = 'voting' 
      WHERE is_active = true
    `;
    
    // Events that are not active and in the past should be 'finalized'
    await sql`
      UPDATE events 
      SET status = 'finalized' 
      WHERE is_active = false 
      AND date < NOW()
    `;
    
    console.log("✅ Migration completed successfully!");
    console.log("Event statuses updated:");
    console.log("- Active events: set to 'voting'");
    console.log("- Past inactive events: set to 'finalized'");
    console.log("- Future events: set to 'upcoming' (default)");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrateAddStatus();
