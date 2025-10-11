#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function activateEvent(eventId: string) {
  try {
    // First, deactivate all events and set status to 'upcoming'
    await sql`UPDATE events SET is_active = false, status = 'upcoming'`;
    console.log("✅ Deactivated all events");

    // Activate the specified event and set status to 'voting'
    const { rows } = await sql`
      UPDATE events 
      SET is_active = true, status = 'voting'
      WHERE id = ${eventId}
      RETURNING id, name, location
    `;

    if (rows.length === 0) {
      console.error(`❌ Event with ID ${eventId} not found`);
      process.exit(1);
    }

    const event = rows[0];
    console.log(`✅ Activated event: ${event.name} (${event.location})`);
    console.log(`   Status set to: voting`);
  } catch (error) {
    console.error("❌ Error activating event:", error);
    process.exit(1);
  }
}

// Get event ID from command line arguments
const eventId = process.argv[2];

if (!eventId) {
  console.error("Usage: tsx activate-event.ts <event-id>");
  console.error(
    "Example: tsx activate-event.ts 123e4567-e89b-12d3-a456-426614174000"
  );
  process.exit(1);
}

activateEvent(eventId);
