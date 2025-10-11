#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function listEvents() {
  try {
    // Get all events with band counts
    const { rows } = await sql`
      SELECT 
        e.id,
        e.name,
        e.date,
        e.location,
        e.is_active,
        e.status,
        COUNT(b.id) as band_count
      FROM events e
      LEFT JOIN bands b ON e.id = b.event_id
      GROUP BY e.id, e.name, e.date, e.location, e.is_active, e.status
      ORDER BY e.date DESC
    `;

    if (rows.length === 0) {
      console.log("No events found.");
      return;
    }

    console.log("📅 Events:\n");

    rows.forEach((event, index) => {
      const statusIcon = event.is_active ? "🟢" : "⚪";
      const statusText = event.status === 'finalized' ? 'FINALIZED' : 
                        event.status === 'voting' ? 'VOTING' : 'UPCOMING';
      const date = new Date(event.date).toLocaleDateString();

      console.log(`${index + 1}. ${event.name}`);
      console.log(`   📍 ${event.location} • ${date}`);
      console.log(`   🎵 ${event.band_count} bands • ${statusIcon} ${statusText}`);
      console.log(`   🆔 ID: ${event.id}\n`);
    });
  } catch (error) {
    console.error("❌ Error listing events:", error);
    process.exit(1);
  }
}

listEvents();
