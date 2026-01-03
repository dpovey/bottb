/**
 * Migration: Add SEO-friendly slugs to photos
 *
 * Adds slug and slug_prefix columns to enable human-readable URLs like:
 * /photos/the-fuggles-brisbane-2024-1
 *
 * Slug hierarchy:
 * 1. band + event: {band-slug}-{event-slug}-{n}
 * 2. event only:   {event-slug}-{n}
 * 3. band only:    {band-slug}-{n}
 * 4. photographer: {photographer-slug}-{n}
 * 5. fallback:     photo-{n}
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // Add slug column - the SEO-friendly URL identifier
  // Nullable initially to allow backfill
  pgm.addColumn('photos', {
    slug: {
      type: 'varchar(255)',
      notNull: false,
      unique: true,
    },
    // Prefix used for sequence grouping (e.g., "the-fuggles-brisbane-2024")
    // Helps efficiently find next sequence number
    slug_prefix: {
      type: 'varchar(255)',
      notNull: false,
    },
  })

  // Index for fast slug lookups (primary access pattern)
  pgm.createIndex('photos', 'slug', {
    name: 'idx_photos_slug',
    where: 'slug IS NOT NULL',
  })

  // Index for sequence number lookups during slug generation
  pgm.createIndex('photos', 'slug_prefix', {
    name: 'idx_photos_slug_prefix',
    where: 'slug_prefix IS NOT NULL',
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropIndex('photos', 'slug_prefix', { name: 'idx_photos_slug_prefix' })
  pgm.dropIndex('photos', 'slug', { name: 'idx_photos_slug' })
  pgm.dropColumn('photos', 'slug_prefix')
  pgm.dropColumn('photos', 'slug')
}
