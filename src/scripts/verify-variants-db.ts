#!/usr/bin/env tsx

/**
 * Quick Database Verification for Responsive Variants
 *
 * Simple query to verify variant URLs are stored in the database
 */

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'

config({ path: '.env.local' })

async function main() {
  console.log('🔍 Verifying responsive variants in database...\n')

  const { rows } = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(p.xmp_metadata->>'thumbnail_2x_url') as has_2x,
      COUNT(p.xmp_metadata->>'medium_url') as has_medium,
      COUNT(p.xmp_metadata->>'large_4k_url') as has_4k,
      COUNT(CASE WHEN p.xmp_metadata->>'thumbnail_2x_url' IS NOT NULL 
                 AND p.xmp_metadata->>'medium_url' IS NOT NULL 
                 AND p.xmp_metadata->>'large_4k_url' IS NOT NULL THEN 1 END) as has_all
    FROM photos p
  `

  const stats = rows[0]

  console.log('📊 Database Verification:')
  console.log(`   Total photos: ${stats.total}`)
  console.log(
    `   Has thumbnail-2x: ${stats.has_2x} (${((stats.has_2x / stats.total) * 100).toFixed(1)}%)`
  )
  console.log(
    `   Has medium (1200px): ${stats.has_medium} (${((stats.has_medium / stats.total) * 100).toFixed(1)}%)`
  )
  console.log(
    `   Has large-4k: ${stats.has_4k} (${((stats.has_4k / stats.total) * 100).toFixed(1)}%)`
  )
  console.log(
    `   Has all variants: ${stats.has_all} (${((stats.has_all / stats.total) * 100).toFixed(1)}%)`
  )

  // Sample URLs to verify format
  const sample = await sql`
    SELECT 
      p.original_filename,
      p.xmp_metadata->>'thumbnail_2x_url' as thumbnail_2x_url,
      p.xmp_metadata->>'medium_url' as medium_url,
      p.xmp_metadata->>'large_4k_url' as large_4k_url
    FROM photos p
    WHERE p.xmp_metadata->>'thumbnail_2x_url' IS NOT NULL
    LIMIT 3
  `

  console.log('\n📝 Sample URLs (first 3 photos):')
  sample.rows.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.original_filename}`)
    if (r.thumbnail_2x_url) {
      console.log(`      2x: ${r.thumbnail_2x_url.substring(0, 70)}...`)
    }
    if (r.medium_url) {
      console.log(`      medium: ${r.medium_url.substring(0, 70)}...`)
    }
    if (r.large_4k_url) {
      console.log(`      4k: ${r.large_4k_url.substring(0, 70)}...`)
    } else {
      console.log(`      4k: N/A (image too small)`)
    }
  })

  // Check for any photos missing 2x or medium (should be 0)
  const missing = await sql`
    SELECT 
      p.id,
      p.original_filename,
      CASE WHEN p.xmp_metadata->>'thumbnail_2x_url' IS NULL THEN '2x ' ELSE '' END ||
      CASE WHEN p.xmp_metadata->>'medium_url' IS NULL THEN 'medium' ELSE '' END as missing
    FROM photos p
    WHERE p.xmp_metadata->>'thumbnail_2x_url' IS NULL 
       OR p.xmp_metadata->>'medium_url' IS NULL
    LIMIT 10
  `

  if (missing.rows.length > 0) {
    console.log('\n⚠️  Photos missing 2x or medium variants:')
    missing.rows.forEach((r) => {
      console.log(`   ${r.original_filename}: missing ${r.missing}`)
    })
  } else {
    console.log('\n✅ All photos have thumbnail-2x and medium variants!')
  }

  console.log('\n✅ Verification complete!')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
