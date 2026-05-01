#!/usr/bin/env tsx

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

config({ path: '.env.local' })

async function renameBand(bandId: string, newName: string) {
  const { rows: before } = await sql`
    SELECT id, name FROM bands WHERE id = ${bandId}
  `
  if (before.length === 0) {
    console.error(`❌ Band ${bandId} not found`)
    process.exit(1)
  }
  console.log(`Before: ${before[0].name}`)

  const { rows } = await sql`
    UPDATE bands SET name = ${newName} WHERE id = ${bandId} RETURNING id, name
  `
  console.log(`After:  ${rows[0].name}`)
}

const [bandId, newName] = process.argv.slice(2)
if (!bandId || !newName) {
  console.log('Usage: tsx src/scripts/rename-band.ts <band-id> <new-name>')
  process.exit(1)
}
renameBand(bandId, newName)
