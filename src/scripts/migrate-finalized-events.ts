#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";
import { finalizeEventResults } from "../lib/db";

// Load environment variables from .env.local
config({ path: ".env.local" });

interface EventRow {
  id: string;
  name: string;
  location: string;
  status: string;
}

async function migrateFinalizedEvents() {
  try {
    console.log(
      "🔄 Migrating finalized events to finalized_results table...\n"
    );

    // Find all finalized events
    const { rows: events } = await sql<EventRow>`
      SELECT id, name, location, status 
      FROM events 
      WHERE status = 'finalized'
      ORDER BY date DESC
    `;

    if (events.length === 0) {
      console.log("✅ No finalized events found to migrate.");
      return;
    }

    console.log(`📋 Found ${events.length} finalized event(s):\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const event of events) {
      console.log(`   Processing: ${event.name} (${event.location})`);
      console.log(`   Event ID: ${event.id}`);

      try {
        // Check if results already exist
        const { rows: existing } = await sql<{ count: number }>`
          SELECT COUNT(*) as count FROM finalized_results 
          WHERE event_id = ${event.id}
        `;

        if (Number(existing[0]?.count) > 0) {
          console.log(`   ⏭️  Skipped - results already exist\n`);
          skipCount++;
          continue;
        }

        // Finalize the event results
        const results = await finalizeEventResults(event.id);

        if (results.length > 0) {
          console.log(`   ✅ Created ${results.length} result entries`);
          console.log(
            `   🏆 Winner: ${results[0].band_name} (${Number(
              results[0].total_score || 0
            ).toFixed(1)} points)\n`
          );
          successCount++;
        } else {
          console.log(`   ⚠️  No scores found for this event\n`);
          skipCount++;
        }
      } catch (error) {
        console.error(`   ❌ Error processing event: ${error}\n`);
        errorCount++;
      }
    }

    console.log("─".repeat(50));
    console.log("\n📊 Migration Summary:");
    console.log(`   ✅ Successfully migrated: ${successCount}`);
    console.log(`   ⏭️  Skipped (already exists): ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📋 Total events: ${events.length}`);
  } catch (error) {
    console.error("❌ Error during migration:", error);
    process.exit(1);
  }
}

migrateFinalizedEvents();
