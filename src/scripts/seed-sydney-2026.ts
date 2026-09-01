#!/usr/bin/env tsx

/**
 * One-off seed for the Sydney 2026 announcement.
 *
 * - Upserts the V2 AI company row (logo/icon uploaded separately via
 *   upload-local-logo.ts).
 * - Sets the Moshtix ticket link, the Jumbo Interactive national partner and
 *   V2 AI as an event sponsor on the sydney-2026 event.
 * - Inserts the four competing bands plus Brisbane 2026 champions ShipReX as
 *   non-competing special guests (mirrors Jumbo at Melbourne 2026).
 *
 * Idempotent: safe to re-run.
 *
 * Usage: pnpm exec tsx src/scripts/seed-sydney-2026.ts
 */

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'
import { nameToSlug } from '../lib/slug-utils'
import { triggerRevalidate } from '../lib/revalidate-client'

config({ path: '.env.local' })

const EVENT_ID = 'sydney-2026'

const TICKET_URL =
  'https://moshtix.com.au/v2/event/battle-of-the-tech-bands/198663'

/**
 * Replaces the placeholder copy ("Stay tuned for tickets") now that the
 * lineup is announced and tickets are on sale.
 */
const DESCRIPTION =
  'Battle of the Tech Bands returns to Sydney for a second year, this time at ' +
  'Manning Bar. Four bands from [Atlassian](/companies/atlassian), ' +
  '[Canva](/companies/canva), [Amazon](/companies/amazon) and ' +
  '[V2 AI](/companies/v2-ai) go head to head for the trophy — with Brisbane ' +
  '2026 champions [ShipReX](/companies/rex-software) joining as special ' +
  'guests. Tickets are on sale now.'

const JUMBO_LOGO =
  'https://0qipqwe5exqqyona.public.blob.vercel-storage.com/companies/jumbo-interactive/logo.svg?v=1765880740505'

/** New company for the 2026 Sydney lineup — also a Sydney event sponsor. */
const NEW_COMPANY = {
  slug: 'v2-ai',
  name: 'V2 AI',
  website: 'https://v2.ai',
  description:
    'V2 AI is an AI-native consultancy that helps enterprises across Asia ' +
    'Pacific move from AI strategy to production — spanning AI strategy and ' +
    'governance, AI literacy and enablement, build and assurance, and AI and ' +
    'data security. Founded in Australia as V2 Digital, it works with ' +
    'enterprises including Westpac, Woolworths and Allianz from offices in ' +
    'Sydney, Melbourne, Brisbane, Perth and Singapore, and partners with AWS, ' +
    'Databricks, Anthropic, Google Cloud and Microsoft.',
}

interface SeedBand {
  name: string
  /** Pin an explicit id to keep URLs stable; defaults to a slug of `name`. */
  id?: string
  company_slug: string
  /** Secondary companies for multi-company bands (primary is company_slug). */
  additional_companies?: string[]
  order: number
  description?: string
}

const BANDS: SeedBand[] = [
  { name: 'Bandlassian', company_slug: 'atlassian', order: 1 },
  { name: 'Canvanauts', company_slug: 'canva', order: 2 },
  { name: 'Amakazaam!', company_slug: 'amazon', order: 3 },
  { name: 'V2 Voyagers', company_slug: 'v2-ai', order: 4 },
  {
    name: 'ShipReX',
    company_slug: 'rex-software',
    additional_companies: ['urbanx'],
    order: 5,
    description: 'Special guest performance (non-competing).',
  },
]

function bandSlug(name: string): string {
  return `${nameToSlug(name)}-${EVENT_ID}`
}

async function main() {
  console.log(`\n\u{1F3B8} Seeding Sydney 2026 announcement\n`)

  // 1. Upsert the new company (logo/icon set by upload-local-logo.ts).
  await sql`
    INSERT INTO companies (slug, name, website, description)
    VALUES (${NEW_COMPANY.slug}, ${NEW_COMPANY.name}, ${NEW_COMPANY.website},
            ${NEW_COMPANY.description})
    ON CONFLICT (slug) DO UPDATE
      SET name = EXCLUDED.name,
          website = COALESCE(companies.website, EXCLUDED.website),
          description = EXCLUDED.description
  `
  console.log(`✅ Company upserted: ${NEW_COMPANY.name} (${NEW_COMPANY.slug})`)

  // 2. Tickets + sponsors on the event's info jsonb.
  const info = {
    ticket_url: TICKET_URL,
    national_partner: {
      name: 'Jumbo Interactive',
      logo_url: JUMBO_LOGO,
    },
    sponsors: [
      {
        name: NEW_COMPANY.name,
        logo_url: '', // filled in below from the companies table
        link: `/companies/${NEW_COMPANY.slug}`,
        label: 'Official Photo and Video Partner',
      },
    ],
  }

  const { rows: companyRows } = await sql`
    SELECT logo_url FROM companies WHERE slug = ${NEW_COMPANY.slug}
  `
  const sponsorLogo = companyRows[0]?.logo_url
  if (!sponsorLogo) {
    throw new Error(
      `No logo_url for ${NEW_COMPANY.slug} — upload it first:\n` +
        `  pnpm exec tsx src/scripts/upload-local-logo.ts ${NEW_COMPANY.slug} <logo.svg> <icon.svg>`
    )
  }
  info.sponsors[0].logo_url = sponsorLogo

  const { rowCount } = await sql`
    UPDATE events
    SET info = COALESCE(info, '{}'::jsonb) || ${JSON.stringify(info)}::jsonb,
        description = ${DESCRIPTION}
    WHERE id = ${EVENT_ID}
  `
  if (rowCount === 0) {
    throw new Error(`Event not found: ${EVENT_ID}`)
  }
  console.log(`🎟️  Ticket URL set: ${TICKET_URL}`)
  console.log(`🤝 Sponsors: Jumbo Interactive (national), ${NEW_COMPANY.name}`)

  // Validate all company slugs exist (primary + additional).
  for (const band of BANDS) {
    for (const slug of [
      band.company_slug,
      ...(band.additional_companies ?? []),
    ]) {
      const { rows } =
        await sql`SELECT name FROM companies WHERE slug = ${slug}`
      if (rows.length === 0) {
        throw new Error(`Missing company "${slug}" for band "${band.name}"`)
      }
    }
  }

  // Wipe the event's existing bands first so re-runs (and band renames, which
  // change the derived id) never leave orphaned rows.
  await sql`
    DELETE FROM band_companies
    WHERE band_id IN (SELECT id FROM bands WHERE event_id = ${EVENT_ID})
  `
  await sql`DELETE FROM bands WHERE event_id = ${EVENT_ID}`

  // 3. Insert bands + their company links.
  for (const band of BANDS) {
    const id = band.id ?? bandSlug(band.name)

    await sql`
      INSERT INTO bands (id, event_id, name, description, company_slug, "order", info)
      VALUES (${id}, ${EVENT_ID}, ${band.name}, ${band.description ?? null},
              ${band.company_slug}, ${band.order}, '{}'::jsonb)
    `

    // Band <-> company links: primary first, then any additional companies.
    await sql`
      INSERT INTO band_companies (band_id, company_slug, is_primary, position)
      VALUES (${id}, ${band.company_slug}, true, 0)
      ON CONFLICT (band_id, company_slug) DO NOTHING
    `
    let companyPosition = 1
    for (const extra of band.additional_companies ?? []) {
      await sql`
        INSERT INTO band_companies (band_id, company_slug, is_primary, position)
        VALUES (${id}, ${extra}, false, ${companyPosition})
        ON CONFLICT (band_id, company_slug) DO NOTHING
      `
      companyPosition++
    }

    console.log(`✅ Band: ${band.name} (${id}) → ${band.company_slug}`)
  }

  await triggerRevalidate({
    paths: [
      '/',
      '/events',
      `/event/${EVENT_ID}`,
      '/companies',
      `/companies/${NEW_COMPANY.slug}`,
      '/sponsors',
    ],
    tags: ['nav-events'],
  })

  console.log('\n🎉 Sydney 2026 seeded')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed:', error)
    process.exit(1)
  })
