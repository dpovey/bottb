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
  // Add is_monochrome column to photos table for B&W vs color classification
  pgm.addColumn('photos', {
    is_monochrome: {
      type: 'boolean',
      default: null,
    },
  })

  // Add index for filtering by color type
  pgm.createIndex('photos', 'is_monochrome', {
    name: 'idx_photos_is_monochrome',
    where: 'is_monochrome IS NOT NULL',
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropIndex('photos', 'is_monochrome', { name: 'idx_photos_is_monochrome' })
  pgm.dropColumn('photos', 'is_monochrome')
}
