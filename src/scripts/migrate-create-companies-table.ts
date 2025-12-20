#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";

// Load environment variables
config({ path: ".env.local" });

async function migrate() {
  console.log("🚀 Starting migration: Create companies table...\n");

  try {
    // Check if table already exists
    const { rows: tables } = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'companies'
    `;

    if (tables.length > 0) {
      console.log(
        "✅ Table 'companies' already exists. Skipping table creation."
      );
    } else {
      // Create companies table
      console.log("📝 Creating 'companies' table...");
      await sql`
        CREATE TABLE companies (
          slug VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          logo_url TEXT,
          website TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
      console.log("✅ Table 'companies' created successfully.");
    }

    // Populate companies from bands
    console.log(
      "\n📝 Populating companies from bands.company_slug and description..."
    );

    // Get distinct company_slug values with their original description (name)
    const { rows: companyData } = await sql`
      SELECT DISTINCT ON (company_slug) company_slug, description
      FROM bands 
      WHERE company_slug IS NOT NULL AND company_slug != ''
      ORDER BY company_slug, created_at ASC
    `;

    let insertedCount = 0;
    let skippedCount = 0;

    for (const company of companyData) {
      // Check if company already exists
      const { rows: existing } = await sql`
        SELECT slug FROM companies WHERE slug = ${company.company_slug}
      `;

      if (existing.length > 0) {
        console.log(
          `  - Skipping existing company: ${company.description} (${company.company_slug})`
        );
        skippedCount++;
        continue;
      }

      // Insert new company with original description as name
      await sql`
        INSERT INTO companies (slug, name)
        VALUES (${company.company_slug}, ${company.description})
      `;
      insertedCount++;
      console.log(
        `  - Added company: ${company.description} → ${company.company_slug}`
      );
    }

    console.log(
      `\n✅ Inserted ${insertedCount} new companies, skipped ${skippedCount} existing.`
    );

    // Create index on name for searching
    const { rows: indexes } = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'companies' AND indexname = 'idx_companies_name'
    `;

    if (indexes.length > 0) {
      console.log(
        "✅ Index 'idx_companies_name' already exists. Skipping index creation."
      );
    } else {
      console.log("\n📝 Creating index on 'name' column...");
      await sql`
        CREATE INDEX idx_companies_name ON companies (name)
      `;
      console.log("✅ Index created successfully.");
    }

    console.log("\n🎉 Migration completed successfully!");

    // Show summary
    const { rows: summary } = await sql`
      SELECT COUNT(*) as count FROM companies
    `;
    console.log(`\n📊 Total companies in database: ${summary[0].count}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();






