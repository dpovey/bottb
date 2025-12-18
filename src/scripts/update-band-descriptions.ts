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

interface BandData {
  name: string;
  description?: string;
  order: number;
}

interface EventData {
  id: string;
  bands: BandData[];
}

async function updateBandDescriptions(filePath: string) {
  try {
    // Read and parse JSON file
    const fileContent = readFileSync(filePath, "utf-8");
    const eventData: EventData = JSON.parse(fileContent);

    if (!eventData.id) {
      console.error("❌ Event file must have an 'id' field");
      process.exit(1);
    }

    console.log(`Updating band descriptions for event: ${eventData.id}`);
    console.log(`Found ${eventData.bands.length} bands in JSON file\n`);

    let updatedCount = 0;

    for (const band of eventData.bands) {
      const bandSlug = nameToSlug(band.name);
      const bandId = `${bandSlug}-${eventData.id}`;

      if (!band.description) {
        console.log(`⏭️  Skipping ${band.name} (no description in JSON)`);
        continue;
      }

      const result = await sql`
        UPDATE bands 
        SET description = ${band.description}
        WHERE id = ${bandId}
        RETURNING id, name
      `;

      if (result.rowCount === 0) {
        console.log(`⚠️  Band not found in database: ${bandId}`);
      } else {
        console.log(`✅ Updated: ${result.rows[0].name}`);
        updatedCount++;
      }
    }

    console.log(`\n🎉 Updated ${updatedCount} band descriptions`);
  } catch (error) {
    console.error("❌ Error updating band descriptions:", error);
    process.exit(1);
  }
}

// Get file path from command line arguments
const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: tsx update-band-descriptions.ts <path-to-json-file>");
  console.error("Example: tsx update-band-descriptions.ts events/sydney-2025.json");
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

updateBandDescriptions(filePath);



