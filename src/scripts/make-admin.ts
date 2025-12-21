#!/usr/bin/env tsx

import { sql } from '@vercel/postgres'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

async function makeAdmin(email: string) {
  try {
    const result = await sql`
      UPDATE users 
      SET is_admin = true 
      WHERE email = ${email}
    `

    if ((result.rowCount ?? 0) > 0) {
      console.log(`✅ User ${email} is now an admin`)
    } else {
      console.log(`❌ User ${email} not found`)
    }
  } catch (error: unknown) {
    console.error(
      `❌ Error:`,
      error instanceof Error ? error.message : String(error)
    )
  }
}

const email = process.argv[2]
if (!email) {
  console.error('❌ Please provide an email address')
  process.exit(1)
}

makeAdmin(email)
