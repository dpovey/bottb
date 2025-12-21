#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

// Load environment variables
config({ path: '.env.local' })

async function migrate() {
  console.log(
    '🚀 Starting migration: Add icon_url column to companies table...\n'
  )

  try {
    // Check if column already exists
    const { rows: columns } = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'companies' AND column_name = 'icon_url'
    `

    if (columns.length > 0) {
      console.log(
        "✅ Column 'icon_url' already exists. Skipping column creation."
      )
    } else {
      // Add icon_url column
      console.log("📝 Adding 'icon_url' column to companies table...")
      await sql`
        ALTER TABLE companies 
        ADD COLUMN icon_url TEXT
      `
      console.log("✅ Column 'icon_url' added successfully.")
    }

    console.log('\n🎉 Migration completed successfully!')

    // Show summary
    const { rows: summary } = await sql`
      SELECT COUNT(*) as total,
             COUNT(logo_url) as with_logo,
             COUNT(icon_url) as with_icon
      FROM companies
    `
    console.log(`\n📊 Companies summary:`)
    console.log(`   Total: ${summary[0].total}`)
    console.log(`   With logo: ${summary[0].with_logo}`)
    console.log(`   With icon: ${summary[0].with_icon}`)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

migrate()
