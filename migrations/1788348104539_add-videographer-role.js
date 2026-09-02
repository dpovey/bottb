/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * Crew credited on an event's video aren't all camera operators — Brisbane
 * 2026 had two videographers plus an engineer recording the multitrack audio
 * the final videos and mixes are built from. `role` labels each credit;
 * existing rows keep the implicit "Videographer" credit.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.addColumn('videographers', {
    role: {
      type: 'varchar(60)',
      notNull: true,
      default: 'Videographer',
    },
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropColumn('videographers', 'role')
}
