#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function finalizeEvent(eventId: string) {
  try {
    // Set event status to 'finalized' and deactivate it
    const { rows } = await sql`
      UPDATE events 
      SET status = 'finalized', is_active = false
      WHERE id = ${eventId}
      RETURNING id, name, location
    `;

    if (rows.length === 0) {
      console.error(`❌ Event with ID ${eventId} not found`);
      process.exit(1);
    }

    const event = rows[0];
    console.log(`✅ Finalized event: ${event.name} (${event.location})`);
    console.log(`   Status set to: finalized`);
    console.log(`   Event deactivated`);
  } catch (error) {
    console.error("❌ Error finalizing event:", error);
    process.exit(1);
  }
}

// Get event ID from command line arguments
const eventId = process.argv[2];

if (!eventId) {
  console.error("Usage: tsx finalize-event.ts <event-id>");
  console.error(
    "Example: tsx finalize-event.ts 123e4567-e89b-12d3-a456-426614174000"
  );
  process.exit(1);
}

finalizeEvent(eventId);
