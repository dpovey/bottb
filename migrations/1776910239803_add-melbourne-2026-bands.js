/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

const COMPANIES = [
  { slug: 'mentorloop', name: 'Mentorloop', website: 'https://mentorloop.com' },
  {
    slug: 'open-universities-australia',
    name: 'Open Universities Australia',
    website: 'https://www.open.edu.au',
  },
  { slug: 'seek', name: 'SEEK', website: 'https://www.seek.com.au' },
  {
    slug: 'rea-group',
    name: 'REA Group',
    website: 'https://www.rea-group.com',
  },
  {
    slug: 'servicenow',
    name: 'ServiceNow',
    website: 'https://www.servicenow.com',
  },
]

const BANDS = [
  {
    id: 'loop-there-it-is-melbourne-2026',
    name: 'LOOP There It Is',
    company_slug: 'mentorloop',
    order: 1,
  },
  {
    id: 'continuously-grooving-melbourne-2026',
    name: 'Continuously Grooving',
    company_slug: 'open-universities-australia',
    order: 2,
  },
  {
    id: 'fully-seek-melbourne-2026',
    name: 'Fully Seek',
    company_slug: 'seek',
    order: 3,
  },
  {
    id: 'hot-property-melbourne-2026',
    name: 'Hot Property',
    company_slug: 'rea-group',
    order: 4,
  },
  {
    id: 'major-incident-melbourne-2026',
    name: 'Major Incident',
    company_slug: 'servicenow',
    order: 5,
  },
]

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  for (const c of COMPANIES) {
    pgm.sql(
      `INSERT INTO companies (slug, name, website)
       VALUES ('${c.slug}', '${c.name.replace(/'/g, "''")}', '${c.website}')
       ON CONFLICT (slug) DO NOTHING`
    )
  }

  for (const b of BANDS) {
    pgm.sql(
      `INSERT INTO bands (id, event_id, name, company_slug, "order", info)
       VALUES ('${b.id}', 'melbourne-2026', '${b.name.replace(/'/g, "''")}', '${b.company_slug}', ${b.order}, '{}'::jsonb)
       ON CONFLICT (id) DO NOTHING`
    )
  }
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.sql(`DELETE FROM bands WHERE event_id = 'melbourne-2026'`)
  pgm.sql(
    `DELETE FROM companies WHERE slug IN ('mentorloop', 'open-universities-australia', 'seek', 'rea-group', 'servicenow')`
  )
}
