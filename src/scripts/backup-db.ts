#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";
import { existsSync, mkdirSync, writeFileSync, statSync } from "fs";
import { join } from "path";

// Load environment variables from .env.local
config({ path: ".env.local" });

interface TableRow {
  [key: string]: unknown;
}

async function backupDatabase() {
  try {
    // Create backups directory if it doesn't exist
    const backupsDir = join(process.cwd(), "backups");
    if (!existsSync(backupsDir)) {
      mkdirSync(backupsDir, { recursive: true });
      console.log("📁 Created backups directory");
    }

    // Generate timestamp for backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = join(backupsDir, `backup-${timestamp}.json`);

    console.log("🔄 Starting database backup...");
    console.log(`   Output file: ${backupFile}`);

    // Define tables to backup in order (respecting foreign key dependencies)
    const tables = [
      "users",
      "events",
      "bands",
      "votes",
      "crowd_noise_measurements",
    ];

    const backup: Record<string, TableRow[]> = {};

    for (const table of tables) {
      console.log(`   📋 Backing up table: ${table}`);
      try {
        const { rows } = await sql.query(`SELECT * FROM ${table}`);
        backup[table] = rows;
        console.log(`      ✓ ${rows.length} rows`);
      } catch (error) {
        // Table might not exist
        console.log(`      ⚠ Table ${table} not found or empty`);
        backup[table] = [];
      }
    }

    // Add metadata
    const backupData = {
      metadata: {
        timestamp: new Date().toISOString(),
        tables: tables,
      },
      data: backup,
    };

    // Write backup file
    writeFileSync(backupFile, JSON.stringify(backupData, null, 2));

    console.log("✅ Database backup completed successfully!");
    console.log(`   Backup saved to: ${backupFile}`);

    // Show backup file size
    const stats = statSync(backupFile);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`   Backup size: ${sizeKB} KB`);

    // Summary
    console.log("\n📊 Backup Summary:");
    for (const table of tables) {
      console.log(`   ${table}: ${backup[table].length} rows`);
    }
  } catch (error) {
    console.error("❌ Error backing up database:", error);
    process.exit(1);
  }
}

backupDatabase();
