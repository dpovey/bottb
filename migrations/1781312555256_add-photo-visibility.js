/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * Add a `visibility` column to photos so newly uploaded photos start private
 * (admin-only) and can be released to the public a few at a time.
 *
 * New rows default to 'private'. Existing photos are backfilled to 'public'
 * so the current live gallery is unchanged.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // Column default 'private' makes every future upload private by default.
  pgm.addColumn('photos', {
    visibility: {
      type: 'varchar(20)',
      notNull: true,
      default: 'private',
    },
  })

  // Backfill: everything already in the gallery stays public.
  pgm.sql(`UPDATE photos SET visibility = 'public'`)

  // Restrict to the two supported states.
  pgm.addConstraint('photos', 'photos_visibility_check', {
    check: "visibility IN ('private', 'public')",
  })

  // Index for filtering public/private in listing queries.
  pgm.createIndex('photos', 'visibility', {
    name: 'idx_photos_visibility',
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropIndex('photos', 'visibility', { name: 'idx_photos_visibility' })
  pgm.dropConstraint('photos', 'photos_visibility_check')
  pgm.dropColumn('photos', 'visibility')
}
