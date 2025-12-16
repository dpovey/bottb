#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";

// Load environment variables from .env.local
config({ path: ".env.local" });

interface EventInfo {
  scoring_version?: string;
  winner?: string;
  [key: string]: unknown;
}

async function addScoringVersion() {
  try {
    console.log("🔄 Adding scoring_version to existing events...\n");

    // Get all events
    const { rows: events } = await sql`SELECT id, name, info FROM events`;

    for (const event of events) {
      const existingInfo: EventInfo = (event.info as EventInfo) || {};
      
      // Skip if scoring_version already set
      if (existingInfo.scoring_version) {
        console.log(`⏭️  ${event.name}: Already has scoring_version: ${existingInfo.scoring_version}`);
        continue;
      }

      let scoringVersion: string;
      let winner: string | undefined;

      // Determine scoring version and winner based on event ID
      if (event.id === "sydney-2025") {
        scoringVersion = "2025.1";
        console.log(`🎯 ${event.name}: Setting scoring_version to ${scoringVersion} (Scream-o-meter)`);
      } else if (event.id === "brisbane-2024") {
        scoringVersion = "2022.1";
        winner = "The Fuggles";
        console.log(`🏆 ${event.name}: Setting scoring_version to ${scoringVersion}, winner: ${winner}`);
      } else if (event.id === "brisbane-2025") {
        scoringVersion = "2022.1";
        winner = "Off The Record";
        console.log(`🏆 ${event.name}: Setting scoring_version to ${scoringVersion}, winner: ${winner}`);
      } else {
        // Default future events to 2026.1
        scoringVersion = "2026.1";
        console.log(`📅 ${event.name}: Setting scoring_version to ${scoringVersion} (Costumes/Backgrounds)`);
      }

      // Update the event's info with scoring_version (and winner if applicable)
      const updatedInfo: EventInfo = {
        ...existingInfo,
        scoring_version: scoringVersion,
      };

      if (winner) {
        updatedInfo.winner = winner;
      }

      await sql`
        UPDATE events 
        SET info = ${JSON.stringify(updatedInfo)}::jsonb
        WHERE id = ${event.id}
      `;

      console.log(`   ✅ Updated ${event.name}`);
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📝 Scoring versions assigned:");
    console.log("   - 2022.1: Single winner display (brisbane-2024, brisbane-2025)");
    console.log("   - 2025.1: With Scream-o-meter (sydney-2025)");
    console.log("   - 2026.1: With Costumes/Backgrounds (future events)");
  } catch (error) {
    console.error("❌ Error during migration:", error);
    process.exit(1);
  }
}

addScoringVersion();


