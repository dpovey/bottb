/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // Add foreign key constraint from bands.company_slug to companies.slug
  // This ensures referential integrity - bands can only reference existing companies
  pgm.addConstraint('bands', 'bands_company_slug_fkey', {
    foreignKeys: {
      columns: 'company_slug',
      references: 'companies(slug)',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropConstraint('bands', 'bands_company_slug_fkey')
}
