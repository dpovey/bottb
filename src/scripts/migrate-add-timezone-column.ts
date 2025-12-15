#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function addTimezoneColumn() {
  try {
    console.log("Adding timezone column to events table...");

    // Add the timezone column with a default value
    await sql`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'Australia/Brisbane'
    `;

    console.log("✅ Timezone column added successfully");

    // List current events to show their timezones
    const { rows: events } = await sql`
      SELECT id, name, location, timezone FROM events ORDER BY date DESC
    `;

    console.log("\n📋 Current events:");
    for (const event of events) {
      console.log(`  - ${event.id}: ${event.name} (${event.location}) - ${event.timezone}`);
    }

    console.log("\n💡 To update a specific event's timezone, run:");
    console.log("   UPDATE events SET timezone = 'Australia/Sydney' WHERE id = 'event-id';");

  } catch (error) {
    console.error("❌ Error adding timezone column:", error);
    process.exit(1);
  }
}

addTimezoneColumn();

