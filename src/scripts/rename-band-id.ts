#!/usr/bin/env tsx

/**
 * Rename a band's id (slug). Because FKs on child tables do not have
 * ON UPDATE CASCADE, we insert a copy with the new id, repoint child
 * rows, then delete the old band row — all inside a single transaction.
 *
 * Child tables updated: votes, crowd_noise_measurements, finalized_results,
 * photos, videos, setlist_songs, social_posts.
 */

import { config } from 'dotenv'
import { db } from '@vercel/postgres'

config({ path: '.env.local' })

async function renameBandId(oldId: string, newId: string) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const before = await client.query(
      'SELECT id, name FROM bands WHERE id = $1',
      [oldId]
    )
    if (before.rows.length === 0) {
      throw new Error(`Band ${oldId} not found`)
    }
    const existing = await client.query('SELECT id FROM bands WHERE id = $1', [
      newId,
    ])
    if (existing.rows.length > 0) {
      throw new Error(`Target id ${newId} already exists`)
    }
    console.log(`Renaming ${oldId} → ${newId} (${before.rows[0].name})`)

    await client.query(
      `INSERT INTO bands (id, name, description, "order", created_at, info, event_id, company_slug)
       SELECT $1, name, description, "order", created_at, info, event_id, company_slug
       FROM bands WHERE id = $2`,
      [newId, oldId]
    )

    const childTables = [
      'votes',
      'crowd_noise_measurements',
      'finalized_results',
      'photos',
      'videos',
      'setlist_songs',
      'social_posts',
    ]
    for (const table of childTables) {
      const result = await client.query(
        `UPDATE ${table} SET band_id = $1 WHERE band_id = $2`,
        [newId, oldId]
      )
      console.log(`  ${table}: ${result.rowCount} rows`)
    }

    await client.query('DELETE FROM bands WHERE id = $1', [oldId])

    await client.query('COMMIT')
    console.log('✅ Done')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Rolled back:', err)
    process.exit(1)
  } finally {
    client.release()
  }
}

const [oldId, newId] = process.argv.slice(2)
if (!oldId || !newId) {
  console.log('Usage: tsx src/scripts/rename-band-id.ts <old-id> <new-id>')
  process.exit(1)
}
renameBandId(oldId, newId)
