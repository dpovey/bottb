import { sql } from '@vercel/postgres'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

async function migrate() {
  console.log('🚀 Starting migration: Add photographers table...\n')

  try {
    // Check if table already exists
    const { rows: tables } = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'photographers'
    `

    if (tables.length > 0) {
      console.log("✅ Table 'photographers' already exists. Skipping creation.")
    } else {
      // Create photographers table
      console.log("📝 Creating 'photographers' table...")
      await sql`
        CREATE TABLE IF NOT EXISTS photographers (
          slug VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          bio TEXT,
          location VARCHAR(255),
          website TEXT,
          instagram TEXT,
          email TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `
      console.log("✅ Table 'photographers' created successfully.")

      // Create index
      console.log('📝 Creating index on photographers(name)...')
      await sql`
        CREATE INDEX IF NOT EXISTS idx_photographers_name ON photographers(name)
      `
      console.log('✅ Index created successfully.')
    }

    console.log('\n✨ Migration completed successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

migrate()
