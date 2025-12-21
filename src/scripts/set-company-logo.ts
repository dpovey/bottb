#!/usr/bin/env tsx

/**
 * Script to manually set a company logo/icon from a URL.
 *
 * Usage:
 *   npx tsx src/scripts/set-company-logo.ts <company-slug> <logo-url> [icon-url]
 *
 * Examples:
 *   npx tsx src/scripts/set-company-logo.ts canva "https://example.com/canva-logo.png"
 *   npx tsx src/scripts/set-company-logo.ts atlassian "https://example.com/atlassian-logo.svg" "https://example.com/atlassian-icon.svg"
 */

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'
import { put } from '@vercel/blob'

// Load environment variables
config({ path: '.env.local' })

async function fetchAndUploadLogo(
  url: string,
  companySlug: string,
  type: 'logo' | 'icon'
): Promise<string | null> {
  try {
    console.log(`  Fetching ${type} from: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BOTTB-Logo-Fetcher/1.0 (https://bottb.com.au)',
      },
    })

    if (!response.ok) {
      console.log(
        `  ⚠️ Failed to fetch: ${response.status} ${response.statusText}`
      )
      return null
    }

    const contentType = response.headers.get('content-type') || 'image/png'
    const buffer = await response.arrayBuffer()

    // Determine extension from URL or content type
    let extension = 'png'
    if (url.endsWith('.svg') || contentType.includes('svg')) {
      extension = 'svg'
    } else if (
      url.endsWith('.jpg') ||
      url.endsWith('.jpeg') ||
      contentType.includes('jpeg')
    ) {
      extension = 'jpg'
    }

    // Upload to blob storage
    const filename = `companies/${companySlug}/${type}.${extension}`
    console.log(`  Uploading to blob: ${filename}`)

    const blob = await put(filename, Buffer.from(buffer), {
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

async function setCompanyLogo() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.log(`
Usage: npx tsx src/scripts/set-company-logo.ts <company-slug> <logo-url> [icon-url]

Arguments:
  company-slug  The slug of the company (e.g., "canva", "atlassian")
  logo-url      URL to fetch the logo from
  icon-url      (Optional) URL to fetch a separate icon from

Examples:
  npx tsx src/scripts/set-company-logo.ts canva "https://example.com/canva-logo.png"
  npx tsx src/scripts/set-company-logo.ts atlassian "https://example.com/atlassian.svg" "https://example.com/atlassian-icon.svg"
`)
    process.exit(1)
  }

  const companySlug = args[0]
  const logoUrl = args[1]
  const iconUrl = args[2] || logoUrl // Use logo URL as icon if not provided

  console.log(`\n🏢 Setting logo for company: ${companySlug}\n`)

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

    // Fetch and upload logo
    const uploadedLogoUrl = await fetchAndUploadLogo(
      logoUrl,
      companySlug,
      'logo'
    )

    // Fetch and upload icon
    const uploadedIconUrl = await fetchAndUploadLogo(
      iconUrl,
      companySlug,
      'icon'
    )

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

setCompanyLogo()
