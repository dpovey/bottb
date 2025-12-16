#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";

// Load environment variables from .env.local
config({ path: ".env.local" });

/**
 * Updates existing events in the database with the correct scoring version.
 * 
 * This script ensures each event has the proper scoring_version in its info JSONB
 * based on the event's characteristics.
 */

interface EventRow {
  id: string;
  name: string;
  date: string;
  info: Record<string, unknown> | null;
}

// Known scoring versions for events
const EVENT_SCORING_VERSIONS: Record<string, { scoring_version: string; winner?: string }> = {
  // 2022.1 events - only display winner, no detailed scores
  "brisbane-2024": { scoring_version: "2022.1", winner: "The Fuggles" },
  "brisbane-2025": { scoring_version: "2022.1", winner: "Off The Record" },
  
  // 2025.1 events - include scream-o-meter
  "sydney-2025": { scoring_version: "2025.1" },
  
  // Future events will default to 2026.1 (new events without explicit version)
};

async function updateEventScoringVersions() {
  try {
    console.log("🔄 Updating event scoring versions...\n");

    // Get all events
    const { rows: events } = await sql<EventRow>`
      SELECT id, name, date, info FROM events ORDER BY date DESC
    `;

    if (events.length === 0) {
      console.log("No events found.");
      return;
    }

    console.log(`📋 Found ${events.length} event(s):\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const event of events) {
      const currentInfo = event.info || {};
      const currentVersion = currentInfo.scoring_version as string | undefined;
      const currentWinner = currentInfo.winner as string | undefined;
      
      // Check if this event has a known configuration
      const knownConfig = EVENT_SCORING_VERSIONS[event.id];
      
      let newVersion: string;
      let newWinner: string | undefined;
      
      if (knownConfig) {
        newVersion = knownConfig.scoring_version;
        newWinner = knownConfig.winner;
      } else {
        // Default to 2026.1 for new events
        newVersion = "2026.1";
      }
      
      // Check if update is needed
      const needsVersionUpdate = currentVersion !== newVersion;
      const needsWinnerUpdate = newWinner && currentWinner !== newWinner;
      
      if (!needsVersionUpdate && !needsWinnerUpdate) {
        console.log(`  ⏭️  ${event.name} (${event.id}): already has correct config`);
        console.log(`      Version: ${currentVersion}, Winner: ${currentWinner || "N/A"}`);
        skippedCount++;
        continue;
      }

      // Build new info object
      const newInfo = {
        ...currentInfo,
        scoring_version: newVersion,
        ...(newWinner && { winner: newWinner }),
      };

      // Update the event
      await sql`
        UPDATE events 
        SET info = ${JSON.stringify(newInfo)}::jsonb
        WHERE id = ${event.id}
      `;

      console.log(`  ✅ ${event.name} (${event.id})`);
      console.log(`      Version: ${currentVersion || "none"} → ${newVersion}`);
      if (newWinner) {
        console.log(`      Winner: ${currentWinner || "none"} → ${newWinner}`);
      }
      updatedCount++;
    }

    console.log("\n" + "─".repeat(50));
    console.log("\n📊 Summary:");
    console.log(`   ✅ Updated: ${updatedCount}`);
    console.log(`   ⏭️  Skipped (already correct): ${skippedCount}`);
    
  } catch (error) {
    console.error("❌ Error updating scoring versions:", error);
    process.exit(1);
  }
}

updateEventScoringVersions();


