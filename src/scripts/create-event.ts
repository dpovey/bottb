#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";
import { readFileSync } from "fs";

// Load environment variables from .env.local
config({ path: ".env.local" });

interface EventData {
  name: string;
  date: string;
  location: string;
  is_active?: boolean;
  status?: "upcoming" | "voting" | "finalized";
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

    // Create event
    const { rows: eventRows } = await sql`
      INSERT INTO events (name, date, location, is_active, status)
      VALUES (${eventData.name}, ${eventData.date}, ${eventData.location}, ${
      eventData.is_active ?? true
    }, ${eventData.status ?? "upcoming"})
      RETURNING id, name
    `;

    const event = eventRows[0];
    console.log(`✅ Event created with ID: ${event.id}`);

    // Create bands
    if (eventData.bands && eventData.bands.length > 0) {
      console.log(`Creating ${eventData.bands.length} bands...`);

      for (const band of eventData.bands) {
        const { rows: bandRows } = await sql`
          INSERT INTO bands (event_id, name, description, "order")
          VALUES (${event.id}, ${band.name}, ${band.description || null}, ${
          band.order
        })
          RETURNING id, name
        `;

        console.log(`  ✅ Band created: ${bandRows[0].name}`);
      }
    }

    console.log(`\n🎉 Event "${eventData.name}" created successfully!`);
    console.log(`Event ID: ${event.id}`);
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
