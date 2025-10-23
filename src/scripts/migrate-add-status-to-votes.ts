#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function addStatusToVotes() {
  try {
    console.log("Adding status column to votes table...");
    
    // Add the status column
    await sql`
      ALTER TABLE votes 
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('approved', 'pending'));
    `;
    
    console.log("✅ Successfully added status column to votes table");
    
    // Update existing votes to have 'approved' status
    await sql`
      UPDATE votes 
      SET status = 'approved' 
      WHERE status IS NULL;
    `;
    
    console.log("✅ Successfully updated existing votes to approved status");
    
  } catch (error) {
    console.error("❌ Error adding status column to votes table:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the migration
addStatusToVotes();
