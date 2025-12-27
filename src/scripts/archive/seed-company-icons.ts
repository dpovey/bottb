#!/usr/bin/env tsx

/**
 * Script to seed company icons from WikiMedia Commons.
 *
 * This script:
 * 1. Fetches logos from WikiMedia Commons for known companies
 * 2. Uploads them to Vercel Blob storage
 * 3. Updates the company records with the icon URLs
 *
 * Usage: npx tsx src/scripts/seed-company-icons.ts
 */

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'
import { put } from '@vercel/blob'

// Load environment variables
config({ path: '.env.local' })

// Company logo sources from WikiMedia Commons
// Using SVG or PNG logos where available, with appropriate sizes for icons
// License info: Most are public domain or CC licensed
const COMPANY_LOGOS: Record<
  string,
  {
    logoUrl: string
    iconUrl?: string // If different from logo
    source: string
    license: string
  }
> = {
  // Major tech companies
  canva: {
    // From https://en.wikipedia.org/wiki/File:Canva_Logo.svg
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/b/bb/Canva_Logo.svg',
    source: 'WikiMedia Commons',
    license: 'Fair use',
  },
  atlassian: {
    // From https://commons.wikimedia.org/wiki/File:Atlassian-logo.svg
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/4/4d/Atlassian-logo.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  amazon: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
    iconUrl:
      'https://upload.wikimedia.org/wikipedia/commons/4/4a/Amazon_icon.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  salesforce: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/f/f9/Salesforce.com_logo.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  pagerduty: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/2/22/PagerDuty_logo.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  datadog: {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/7/7e/Datadog_logo.svg',
    source: 'WikiMedia Commons',
    license: 'Fair use',
  },
  google: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg',
    iconUrl:
      'https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  microsoft: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg',
    iconUrl:
      'https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  meta: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  apple: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  netflix: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg',
    iconUrl:
      'https://upload.wikimedia.org/wikipedia/commons/0/0c/Netflix_2015_N_logo.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  spotify: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  slack: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  github: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/9/91/Octicons-mark-github.svg',
    source: 'WikiMedia Commons',
    license: 'MIT License',
  },
  twitter: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/6/6f/Logo_of_Twitter.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  linkedin: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  shopify: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/0/0e/Shopify_logo_2018.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  stripe: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  twilio: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/7/7e/Twilio-logo-red.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  dropbox: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/c/cb/Dropbox_logo_2017.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  zendesk: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/c/c8/Zendesk_logo.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  hubspot: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/3/3f/HubSpot_Logo.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  airtable: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/4/4b/Airtable_Logo.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  notion: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png',
    source: 'WikiMedia Commons',
    license: 'Fair use',
  },
  figma: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/3/33/Figma-logo.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  adobe: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/8/8d/Adobe_Corporate_Logo.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  oracle: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/5/50/Oracle_logo.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  ibm: {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/51/IBM_logo.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  cisco: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/0/08/Cisco_logo_blue_2016.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  vmware: {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Vmware.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  servicenow: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/5/57/ServiceNow_logo.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  workday: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/8/80/Workday_logo.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  splunk: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/e/e8/Splunk-Logo.jpg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  cloudflare: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/9/94/Cloudflare_Logo.png',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  mongodb: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/9/93/MongoDB_Logo.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  redis: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/6/64/Logo-redis.svg',
    source: 'WikiMedia Commons',
    license: 'BSD',
  },
  elastic: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/f/f4/Elasticsearch_logo.svg',
    source: 'WikiMedia Commons',
    license: 'Public domain',
  },
  docker: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/4/4e/Docker_%28container_engine%29_logo.svg',
    source: 'WikiMedia Commons',
    license: 'Apache 2.0',
  },
  kubernetes: {
    logoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/3/39/Kubernetes_logo_without_workmark.svg',
    source: 'WikiMedia Commons',
    license: 'Apache 2.0',
  },
}

// Mapping of potential company name patterns to WikiMedia company slugs
// This helps match companies in your database to the logos above
const COMPANY_NAME_MAPPINGS: Record<string, string> = {
  // Direct mappings (slug -> wikimedia key)
  canva: 'canva',
  atlassian: 'atlassian',
  amazon: 'amazon',
  salesforce: 'salesforce',
  pagerduty: 'pagerduty',
  datadog: 'datadog',
  google: 'google',
  microsoft: 'microsoft',
  meta: 'meta',
  facebook: 'meta',
  apple: 'apple',
  netflix: 'netflix',
  spotify: 'spotify',
  slack: 'slack',
  github: 'github',
  twitter: 'twitter',
  linkedin: 'linkedin',
  shopify: 'shopify',
  stripe: 'stripe',
  twilio: 'twilio',
  dropbox: 'dropbox',
  zendesk: 'zendesk',
  hubspot: 'hubspot',
  airtable: 'airtable',
  notion: 'notion',
  figma: 'figma',
  adobe: 'adobe',
  oracle: 'oracle',
  ibm: 'ibm',
  cisco: 'cisco',
  vmware: 'vmware',
  servicenow: 'servicenow',
  workday: 'workday',
  splunk: 'splunk',
  cloudflare: 'cloudflare',
  mongodb: 'mongodb',
  redis: 'redis',
  elastic: 'elastic',
  docker: 'docker',
  kubernetes: 'kubernetes',
  // Variations and aliases
  aws: 'amazon',
  'amazon-web-services': 'amazon',
  'meta-platforms': 'meta',
  'github-inc': 'github',
  'vmware-inc': 'vmware',
  'service-now': 'servicenow',
}

async function fetchAndUploadLogo(
  url: string,
  companySlug: string,
  type: 'logo' | 'icon'
): Promise<string | null> {
  try {
    console.log(`  Fetching ${type} from: ${url}`)

    const response = await fetch(url, {
      headers: {
        // Set a user agent to be polite to WikiMedia
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
      addRandomSuffix: false, // Use consistent filename
      contentType: contentType,
    })

    console.log(`  ✅ Uploaded: ${blob.url}`)
    return blob.url
  } catch (error) {
    console.error(`  ❌ Error processing ${type}:`, error)
    return null
  }
}

async function seedCompanyIcons() {
  console.log('🚀 Starting company icon seeding...\n')

  try {
    // Get all companies from database
    const { rows: companies } = await sql<{
      slug: string
      name: string
      logo_url: string | null
      icon_url: string | null
    }>`SELECT slug, name, logo_url, icon_url FROM companies ORDER BY name`

    console.log(`📦 Found ${companies.length} companies in database\n`)

    let updatedCount = 0
    let skippedCount = 0
    let failedCount = 0

    for (const company of companies) {
      console.log(`\n🏢 Processing: ${company.name} (${company.slug})`)

      // Try to find a matching logo source
      const logoKey =
        COMPANY_NAME_MAPPINGS[company.slug.toLowerCase()] ||
        COMPANY_NAME_MAPPINGS[company.name.toLowerCase().replace(/\s+/g, '-')]

      if (!logoKey || !COMPANY_LOGOS[logoKey]) {
        console.log(`  ⏭️ No WikiMedia logo mapping found`)
        skippedCount++
        continue
      }

      const logoSource = COMPANY_LOGOS[logoKey]
      let logoUrl = company.logo_url
      let iconUrl = company.icon_url

      // Fetch and upload logo if not already set
      if (!logoUrl) {
        logoUrl = await fetchAndUploadLogo(
          logoSource.logoUrl,
          company.slug,
          'logo'
        )
      } else {
        console.log(`  📌 Logo already set: ${logoUrl}`)
      }

      // Fetch and upload icon if not already set
      if (!iconUrl) {
        // Use dedicated icon URL if available, otherwise use the logo
        const iconSourceUrl = logoSource.iconUrl || logoSource.logoUrl
        iconUrl = await fetchAndUploadLogo(iconSourceUrl, company.slug, 'icon')
      } else {
        console.log(`  📌 Icon already set: ${iconUrl}`)
      }

      // Update database if we have new URLs
      if (logoUrl !== company.logo_url || iconUrl !== company.icon_url) {
        console.log(`  💾 Updating database...`)
        await sql`
          UPDATE companies 
          SET logo_url = ${logoUrl}, icon_url = ${iconUrl}
          WHERE slug = ${company.slug}
        `
        updatedCount++
      } else if (logoUrl || iconUrl) {
        console.log(`  ℹ️ No changes needed`)
      } else {
        failedCount++
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('🎉 Seeding complete!')
    console.log(`   Updated: ${updatedCount}`)
    console.log(`   Skipped: ${skippedCount}`)
    console.log(`   Failed: ${failedCount}`)

    // Show final summary
    const { rows: summary } = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(logo_url) as with_logo,
        COUNT(icon_url) as with_icon
      FROM companies
    `
    console.log('\n📊 Final summary:')
    console.log(`   Total companies: ${summary[0].total}`)
    console.log(`   With logo: ${summary[0].with_logo}`)
    console.log(`   With icon: ${summary[0].with_icon}`)
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  }
}

// Run the script
seedCompanyIcons()
