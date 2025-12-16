#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";

// Load environment variables
config({ path: ".env.local" });

/**
 * Converts a company name to a URL-friendly slug
 * e.g., "Salesforce" → "salesforce", "Google Cloud" → "google-cloud"
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

async function migrate() {
  console.log(
    "🚀 Starting migration: Add company_slug column to bands table...\n"
  );

  try {
    // Check if column already exists
    const { rows: columns } = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bands' AND column_name = 'company_slug'
    `;

    if (columns.length > 0) {
      console.log(
        "✅ Column 'company_slug' already exists. Skipping column creation."
      );
    } else {
      // Add company_slug column
      console.log("📝 Adding 'company_slug' column to bands table...");
      await sql`
        ALTER TABLE bands 
        ADD COLUMN company_slug VARCHAR(255)
      `;
      console.log("✅ Column 'company_slug' added successfully.");
    }

    // Populate company_slug from description
    console.log(
      "\n📝 Populating company_slug from existing description values..."
    );

    const { rows: bands } = await sql`
      SELECT id, description FROM bands WHERE description IS NOT NULL AND description != ''
    `;

    let updatedCount = 0;
    for (const band of bands) {
      const slug = slugify(band.description);
      if (slug) {
        await sql`
          UPDATE bands SET company_slug = ${slug} WHERE id = ${band.id}
        `;
        updatedCount++;
        console.log(`  - ${band.description} → ${slug}`);
      }
    }
    console.log(`✅ Updated ${updatedCount} bands with company_slug.`);

    // Check if index already exists
    const { rows: indexes } = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'bands' AND indexname = 'idx_bands_company_slug'
    `;

    if (indexes.length > 0) {
      console.log(
        "✅ Index 'idx_bands_company_slug' already exists. Skipping index creation."
      );
    } else {
      // Create index for efficient company queries
      console.log("\n📝 Creating index on 'company_slug' column...");
      await sql`
        CREATE INDEX idx_bands_company_slug ON bands (company_slug)
      `;
      console.log("✅ Index created successfully.");
    }

    console.log("\n🎉 Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();

