import { sql } from "@vercel/postgres";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

async function migratePublicToCrowd() {
  try {
    console.log("Starting migration: public -> crowd");

    // First, drop the existing constraint
    await sql`
      ALTER TABLE votes 
      DROP CONSTRAINT IF EXISTS votes_voter_type_check
    `;

    console.log("Dropped existing constraint");

    // Update all existing 'public' voter_type records to 'crowd'
    const { rowCount } = await sql`
      UPDATE votes 
      SET voter_type = 'crowd' 
      WHERE voter_type = 'public'
    `;

    console.log(`Updated ${rowCount} vote records from 'public' to 'crowd'`);

    // Add the new constraint
    await sql`
      ALTER TABLE votes 
      ADD CONSTRAINT votes_voter_type_check 
      CHECK (voter_type IN ('crowd', 'judge'))
    `;

    console.log("Added new constraint with 'crowd' instead of 'public'");

    // Verify the migration
    const { rows } = await sql`
      SELECT voter_type, COUNT(*) as count 
      FROM votes 
      GROUP BY voter_type
    `;

    console.log("Current voter_type distribution:");
    rows.forEach((row) => {
      console.log(`  ${row.voter_type}: ${row.count} votes`);
    });

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migratePublicToCrowd();
