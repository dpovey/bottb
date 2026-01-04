/**
 * Add missing indexes to photo_clusters table for gallery query performance.
 *
 * These indexes were supposed to be created in the original photo-intelligence migration
 * but may be missing from production. This migration adds them if they don't exist.
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
  // GIN index for array containment queries (p.id = ANY(pc.photo_ids))
  // This is critical for the grouped photos query performance
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_photo_clusters_photo_ids_gin 
    ON photo_clusters USING gin(photo_ids);
  `)

  // Index for representative photo lookups
  // Speeds up checking if a photo is a cluster representative
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_photo_clusters_representative 
    ON photo_clusters(representative_photo_id) 
    WHERE representative_photo_id IS NOT NULL;
  `)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS idx_photo_clusters_representative')
  pgm.sql('DROP INDEX IF EXISTS idx_photo_clusters_photo_ids_gin')
}
