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
  // Videographers — mirrors the photographers table
  pgm.createTable('videographers', {
    slug: { type: 'varchar(255)', primaryKey: true },
    name: { type: 'varchar(255)', notNull: true },
    bio: { type: 'text' },
    location: { type: 'varchar(255)' },
    website: { type: 'text' },
    instagram: { type: 'text' },
    email: { type: 'text' },
    avatar_url: { type: 'text' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  })
  pgm.createIndex('videographers', 'name', { name: 'idx_videographers_name' })

  // A videographer shoots a whole event — many-to-many join
  pgm.createTable('event_videographers', {
    event_id: {
      type: 'varchar(255)',
      notNull: true,
      references: 'events(id)',
      onDelete: 'CASCADE',
    },
    videographer_slug: {
      type: 'varchar(255)',
      notNull: true,
      references: 'videographers(slug)',
      onDelete: 'CASCADE',
    },
  })
  pgm.addConstraint('event_videographers', 'event_videographers_pkey', {
    primaryKey: ['event_id', 'videographer_slug'],
  })
  pgm.createIndex('event_videographers', 'videographer_slug', {
    name: 'idx_event_videographers_slug',
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('event_videographers')
  pgm.dropTable('videographers')
}
