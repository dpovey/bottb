#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function addNameToVotes() {
  try {
    console.log("Adding name column to votes table...");
    
    // Add the name column
    await sql`
      ALTER TABLE votes 
      ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    `;
    
    console.log("✅ Successfully added name column to votes table");
    
  } catch (error) {
    console.error("❌ Error adding name column to votes table:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the migration
addNameToVotes();
