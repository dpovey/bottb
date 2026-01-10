#!/usr/bin/env tsx

/**
 * Script to upload local logo/icon files and link to a company.
 *
 * Usage:
 *   npx tsx src/scripts/upload-local-logo.ts <company-slug> <logo-path> [icon-path]
 */

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'
import { put } from '@vercel/blob'
import { readFileSync } from 'fs'
import { extname } from 'path'

// Load environment variables
config({ path: '.env.local' })

async function uploadLocalFile(
  filePath: string,
  companySlug: string,
  type: 'logo' | 'icon'
): Promise<string | null> {
  try {
    console.log(`  Reading ${type} from: ${filePath}`)

    const buffer = readFileSync(filePath)

    // Determine extension and content type
    const ext = extname(filePath).slice(1) || 'png'
    const contentTypeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      svg: 'image/svg+xml',
      webp: 'image/webp',
    }
    const contentType = contentTypeMap[ext] || 'image/png'

    // Upload to blob storage
    const filename = `companies/${companySlug}/${type}.${ext}`
    console.log(`  Uploading to blob: ${filename}`)

    const blob = await put(filename, buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: contentType,
      allowOverwrite: true,
    })

    console.log(`  ✅ Uploaded: ${blob.url}`)
    return blob.url
  } catch (error) {
    console.error(`  ❌ Error processing ${type}:`, error)
    return null
  }
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.log(`
Usage: npx tsx src/scripts/upload-local-logo.ts <company-slug> <logo-path> [icon-path]

Arguments:
  company-slug  The slug of the company (e.g., "teachstarter")
  logo-path     Local path to the logo file
  icon-path     (Optional) Local path to the icon file
`)
    process.exit(1)
  }

  const companySlug = args[0]
  const logoPath = args[1]
  const iconPath = args[2] || logoPath

  console.log(`\n🏢 Uploading logos for company: ${companySlug}\n`)

  try {
    // Check if company exists
    const { rows: companies } = await sql`
      SELECT slug, name, logo_url, icon_url FROM companies WHERE slug = ${companySlug}
    `

    if (companies.length === 0) {
      console.error(`❌ Company not found: ${companySlug}`)
      console.log('\nAvailable companies:')
      const { rows: all } =
        await sql`SELECT slug, name FROM companies ORDER BY name`
      all.forEach((c) => console.log(`  - ${c.slug}: ${c.name}`))
      process.exit(1)
    }

    const company = companies[0]
    console.log(`Found company: ${company.name}`)

    // Upload logo
    const uploadedLogoUrl = await uploadLocalFile(logoPath, companySlug, 'logo')

    // Upload icon
    const uploadedIconUrl = await uploadLocalFile(iconPath, companySlug, 'icon')

    if (uploadedLogoUrl || uploadedIconUrl) {
      console.log(`\n💾 Updating database...`)
      await sql`
        UPDATE companies 
        SET 
          logo_url = COALESCE(${uploadedLogoUrl}, logo_url),
          icon_url = COALESCE(${uploadedIconUrl}, icon_url)
        WHERE slug = ${companySlug}
      `
      console.log(`✅ Database updated!`)
    } else {
      console.log(`\n⚠️ No logos were uploaded - database not updated`)
    }

    // Show final state
    const { rows: updated } = await sql`
      SELECT logo_url, icon_url FROM companies WHERE slug = ${companySlug}
    `
    console.log(`\n📊 Final state for ${company.name}:`)
    console.log(`   Logo: ${updated[0]?.logo_url || '(not set)'}`)
    console.log(`   Icon: ${updated[0]?.icon_url || '(not set)'}`)
  } catch (error) {
    console.error('❌ Failed:', error)
    process.exit(1)
  }
}

main()
