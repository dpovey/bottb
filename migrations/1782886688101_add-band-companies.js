/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * Multi-company bands (see doc/requirements/multi-company-bands.md).
 *
 * Adds a `band_companies` join table so a band can be made up of members from
 * more than one company (motivating case: ShipReX = Rex Software + UrbanX in
 * brisbane-2026). `bands.company_slug` is retained as the primary/lead company
 * for backward compatibility; the `is_primary` join row mirrors it.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS band_companies (
      band_id      character varying(255) NOT NULL REFERENCES bands(id)       ON DELETE CASCADE,
      company_slug character varying(255) NOT NULL REFERENCES companies(slug) ON DELETE CASCADE ON UPDATE CASCADE,
      is_primary   boolean NOT NULL DEFAULT false,
      position     integer NOT NULL DEFAULT 0,
      PRIMARY KEY (band_id, company_slug)
    )
  `)

  pgm.sql(
    `CREATE INDEX IF NOT EXISTS idx_band_companies_company ON band_companies(company_slug)`
  )

  // At most one primary company per band; keeps the join table's primary row in
  // sync with bands.company_slug.
  pgm.sql(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_band_companies_primary ON band_companies(band_id) WHERE is_primary`
  )

  // Backfill: every existing band's single company becomes its primary.
  pgm.sql(`
    INSERT INTO band_companies (band_id, company_slug, is_primary, position)
    SELECT id, company_slug, true, 0
    FROM bands
    WHERE company_slug IS NOT NULL
    ON CONFLICT (band_id, company_slug) DO NOTHING
  `)

  // UrbanX is a co-owner of ShipReX (brisbane-2026) but has never had a company
  // row. Logo/icon/website are set separately via set-company-logo.ts.
  pgm.sql(
    `INSERT INTO companies (slug, name) VALUES ('urbanx', 'UrbanX') ON CONFLICT (slug) DO NOTHING`
  )
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS band_companies`)
  // Leave the UrbanX company row in place; dropping it is out of scope for the
  // schema rollback and it is harmless on its own.
}
