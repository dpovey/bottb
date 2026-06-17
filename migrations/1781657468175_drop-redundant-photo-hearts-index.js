/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * Drop the redundant `idx_photo_hearts_photo` index.
 *
 * `photo_hearts` has a composite unique constraint on (photo_id, visitor_key).
 * Postgres backs that with a unique index whose leading column is photo_id, so
 * it already serves any lookup/join filtering by photo_id alone. The separate
 * single-column index just adds write/maintenance overhead.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.dropIndex('photo_hearts', 'photo_id', {
    name: 'idx_photo_hearts_photo',
    ifExists: true,
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.createIndex('photo_hearts', 'photo_id', {
    name: 'idx_photo_hearts_photo',
  })
}
