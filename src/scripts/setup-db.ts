#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";
import { readFileSync } from "fs";
import { join } from "path";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function setupDatabase() {
  try {
    console.log("Setting up database schema...");

    // Read and execute the schema file
    const schemaPath = join(process.cwd(), "src/lib/schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");

    // Split by semicolon and execute each statement
    const statements = schema
      .split(";")
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await sql.query(statement);
      }
    }

    console.log("✅ Database schema created successfully!");

  } catch (error) {
    console.error("❌ Error setting up database:", error);
    process.exit(1);
  }
}

setupDatabase();
