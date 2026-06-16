/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * Add public "hearts" (likes) and a persistent download counter to photos.
 *
 * - `heart_count` / `download_count` are denormalized counters on photos so
 *   listing queries can read them cheaply (no per-photo aggregation).
 * - `photo_hearts` stores one row per (photo, visitor) so a heart can be
 *   toggled on/off and deduped per anonymous visitor. `heart_count` is kept
 *   authoritative from this table by the toggle query.
 *
 * Downloads are not deduped (every download counts), so there is no
 * per-visitor download table — only the counter column.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.addColumn('photos', {
    heart_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    download_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
  })

  pgm.createTable('photo_hearts', {
    id: {
      type: 'uuid',
      notNull: true,
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    photo_id: {
      type: 'uuid',
      notNull: true,
      references: 'photos(id)',
      onDelete: 'CASCADE',
    },
    // FingerprintJS visitor id when available, else the server-side
    // vote_fingerprint hash. Identifies an anonymous visitor for dedup.
    visitor_key: {
      type: 'varchar(255)',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('now()'),
    },
  })

  // One heart per visitor per photo — the source of truth for heart_count.
  pgm.addConstraint('photo_hearts', 'photo_hearts_photo_visitor_unique', {
    unique: ['photo_id', 'visitor_key'],
  })

  // Fast lookups / counts for a given photo.
  pgm.createIndex('photo_hearts', 'photo_id', {
    name: 'idx_photo_hearts_photo',
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('photo_hearts')
  pgm.dropColumn('photos', ['heart_count', 'download_count'])
}
