#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";
import { readFileSync } from "fs";

// Load environment variables from .env.local
config({ path: ".env.local" });

// Helper function to convert name to slug
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters except spaces and hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .trim();
}

// Helper function to generate band slug using event ID (not full name)
function generateBandSlug(bandName: string, eventId: string): string {
  const bandSlug = nameToSlug(bandName);
  return `${bandSlug}-${eventId}`;
}

// Valid scoring versions
type ScoringVersion = "2022.1" | "2025.1" | "2026.1";

function isValidScoringVersion(version: string): version is ScoringVersion {
  return version === "2022.1" || version === "2025.1" || version === "2026.1";
}

interface EventData {
  id?: string; // Optional custom ID (e.g., "brisbane-2024" instead of auto-generated)
  name: string;
  date: string;
  location: string;
  timezone: string; // IANA timezone name (e.g., "Australia/Brisbane")
  address?: string;
  tickets?: string;
  is_active?: boolean;
  status?: "upcoming" | "voting" | "finalized";
  scoring_version?: string; // Scoring version: "2022.1", "2025.1", "2026.1"
  winner?: string; // Winner name (for 2022.1 events)
  bands: {
    name: string;
    description?: string;
    order: number;
  }[];
}

async function createEventFromFile(filePath: string) {
  try {
    // Read and parse JSON file
    const fileContent = readFileSync(filePath, "utf-8");
    const eventData: EventData = JSON.parse(fileContent);

    console.log(`Creating event: ${eventData.name}`);

    // Use custom ID if provided, otherwise generate from name
    const eventSlug = eventData.id || nameToSlug(eventData.name);
    console.log(`📝 Event slug: ${eventSlug}${eventData.id ? " (custom)" : " (auto-generated)"}`);

    // Validate and set scoring version
    const scoringVersion = eventData.scoring_version || "2026.1"; // Default to latest
    if (!isValidScoringVersion(scoringVersion)) {
      console.error(`❌ Invalid scoring_version: ${scoringVersion}`);
      console.error("   Valid values: 2022.1, 2025.1, 2026.1");
      process.exit(1);
    }
    console.log(`📊 Scoring version: ${scoringVersion}`);

    // Build event info JSONB object
    interface EventInfo {
      scoring_version: string;
      address?: string;
      tickets?: string;
      winner?: string;
    }
    
    const eventInfo: EventInfo = {
      scoring_version: scoringVersion,
    };

    if (eventData.address) {
      eventInfo.address = eventData.address;
    }
    if (eventData.tickets) {
      eventInfo.tickets = eventData.tickets;
    }

    // For 2022.1 events, store the winner in event info
    if (scoringVersion === "2022.1" && eventData.winner) {
      eventInfo.winner = eventData.winner;
      console.log(`🏆 Winner: ${eventData.winner}`);
    }

    // Validate timezone
    if (!eventData.timezone) {
      console.error("❌ Missing required field: timezone");
      console.error("   Example: \"Australia/Brisbane\"");
      process.exit(1);
    }
    console.log(`🌏 Timezone: ${eventData.timezone}`);

    // Create event with slug as ID and info JSONB
    const { rows: eventRows } = await sql`
      INSERT INTO events (id, name, date, location, timezone, is_active, status, info)
      VALUES (
        ${eventSlug}, 
        ${eventData.name}, 
        ${eventData.date}, 
        ${eventData.location},
        ${eventData.timezone},
        ${eventData.is_active ?? true}, 
        ${eventData.status ?? "upcoming"},
        ${JSON.stringify(eventInfo)}::jsonb
      )
      RETURNING id, name
    `;

    const event = eventRows[0];
    console.log(`✅ Event created with ID: ${event.id}`);

    // Create bands
    if (eventData.bands && eventData.bands.length > 0) {
      console.log(`Creating ${eventData.bands.length} bands...`);

      for (const band of eventData.bands) {
        // Generate band slug using event ID (not full name)
        const bandSlug = generateBandSlug(band.name, eventSlug);
        console.log(`  📝 Band slug: ${bandSlug}`);

        const { rows: bandRows } = await sql`
          INSERT INTO bands (id, event_id, name, description, "order")
          VALUES (${bandSlug}, ${event.id}, ${band.name}, ${
          band.description || null
        }, ${band.order})
          RETURNING id, name
        `;

        console.log(
          `  ✅ Band created: ${bandRows[0].name} (${bandRows[0].id})`
        );
      }
    }

    console.log(`\n🎉 Event "${eventData.name}" created successfully!`);
    console.log(`Event ID: ${event.id}`);
    console.log(`Scoring Version: ${scoringVersion}`);
    console.log(`Bands: ${eventData.bands.length}`);
  } catch (error) {
    console.error("❌ Error creating event:", error);
    process.exit(1);
  }
}

// Get file path from command line arguments
const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: tsx create-event.ts <path-to-json-file>");
  console.error("Example: tsx create-event.ts events/sydney-2024.json");
  console.error("\nJSON file should include:");
  console.error("  - id: event slug (e.g., 'sydney-2025')");
  console.error("  - name: event name");
  console.error("  - date: ISO date string (UTC)");
  console.error("  - location: venue name");
  console.error("  - timezone: IANA timezone (e.g., 'Australia/Brisbane', 'Australia/Sydney')");
  console.error("  - scoring_version: '2022.1' | '2025.1' | '2026.1' (default: '2026.1')");
  console.error("  - winner: (for 2022.1 events only) winner band name");
  console.error("  - bands: array of band objects");
  process.exit(1);
}

// Check if file exists
import { accessSync } from "fs";
try {
  accessSync(filePath);
} catch {
  console.error(`❌ File not found: ${filePath}`);
  process.exit(1);
}

createEventFromFile(filePath);
