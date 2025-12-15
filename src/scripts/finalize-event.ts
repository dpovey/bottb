#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";
import { finalizeEventResults, hasFinalizedResults } from "../lib/db";
import { parseScoringVersion } from "../lib/scoring";

// Load environment variables from .env.local
config({ path: ".env.local" });

interface EventInfo {
  scoring_version?: string;
  winner?: string; // Legacy: band name (deprecated)
  winner_band_id?: string; // Preferred: band ID
  [key: string]: unknown;
}

async function finalizeEvent(eventId: string, force = false) {
  try {
    // Get the event
    const { rows: events } = await sql`
      SELECT id, name, location, status, info
      FROM events 
      WHERE id = ${eventId}
    `;

    if (events.length === 0) {
      console.error(`❌ Event with ID ${eventId} not found`);
      process.exit(1);
    }

    const event = events[0];
    const eventInfo = event.info as EventInfo | null;
    const scoringVersion = parseScoringVersion(eventInfo);

    console.log(`\n📋 Finalizing event: ${event.name}`);
    console.log(`   Location: ${event.location}`);
    console.log(`   Current status: ${event.status}`);
    console.log(`   Scoring version: ${scoringVersion}`);

    // Check if results already exist
    const hasResults = await hasFinalizedResults(eventId);
    if (hasResults && !force) {
      console.log(`\n⚠️  Finalized results already exist for this event.`);
      console.log(`   Use --force to overwrite existing results.`);
      process.exit(1);
    }

    // For 2022.1 events, we don't calculate scores - just check for winner
    if (scoringVersion === "2022.1") {
      const hasWinner = eventInfo?.winner_band_id || eventInfo?.winner;
      if (!hasWinner) {
        console.error(
          `\n❌ 2022.1 events require a winner to be set in the event info.`
        );
        console.error(
          `   Please set info.winner_band_id (preferred) or info.winner (legacy).`
        );
        process.exit(1);
      }

      // Get the winner band name for display
      let winnerDisplay = eventInfo?.winner || eventInfo?.winner_band_id;
      if (eventInfo?.winner_band_id) {
        const { rows: winnerBands } = await sql`
          SELECT name FROM bands WHERE id = ${eventInfo.winner_band_id}
        `;
        if (winnerBands.length > 0) {
          winnerDisplay = winnerBands[0].name;
        }
      }

      // Set event status to finalized
      await sql`
        UPDATE events 
        SET status = 'finalized', is_active = false
        WHERE id = ${eventId}
      `;

      console.log(`\n✅ Event finalized successfully!`);
      console.log(`   Status: finalized`);
      console.log(`   🏆 Winner: ${winnerDisplay}`);
      if (eventInfo?.winner_band_id) {
        console.log(`   Band ID: ${eventInfo.winner_band_id}`);
      }
      console.log(
        `\n📝 Note: 2022.1 events only store the winner, no detailed scores.`
      );
      return;
    }

    // For 2025.1 and 2026.1, calculate and store detailed results
    console.log(`\n🔄 Calculating and storing results...`);

    const results = await finalizeEventResults(eventId, scoringVersion);

    if (results.length === 0) {
      console.error(`\n❌ No votes found for this event. Cannot finalize.`);
      process.exit(1);
    }

    // Set event status to finalized
    await sql`
      UPDATE events 
      SET status = 'finalized', is_active = false
      WHERE id = ${eventId}
    `;

    console.log(`\n✅ Event finalized successfully!`);
    console.log(`   Status: finalized`);
    console.log(`   Results stored: ${results.length} bands`);

    // Show top 3
    console.log(`\n🏆 Top 3:`);
    for (let i = 0; i < Math.min(3, results.length); i++) {
      const result = results[i];
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
      console.log(
        `   ${medal} ${result.band_name}: ${Number(result.total_score).toFixed(
          1
        )} points`
      );
    }
  } catch (error) {
    console.error("❌ Error finalizing event:", error);
    process.exit(1);
  }
}

// Get event ID from command line arguments
const args = process.argv.slice(2);
const eventId = args.find((arg) => !arg.startsWith("--"));
const force = args.includes("--force");

if (!eventId) {
  console.error("Usage: tsx finalize-event.ts <event-id> [--force]");
  console.error("Example: tsx finalize-event.ts sydney-2025");
  console.error("\nOptions:");
  console.error("  --force   Overwrite existing finalized results");
  process.exit(1);
}

finalizeEvent(eventId, force);
