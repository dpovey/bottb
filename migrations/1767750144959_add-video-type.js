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
  // Add video_type column to distinguish regular videos from shorts
  pgm.addColumn('videos', {
    video_type: {
      type: 'varchar(20)',
      default: 'video',
      notNull: true,
    },
  })

  // Add check constraint
  pgm.addConstraint('videos', 'videos_video_type_check', {
    check: "video_type IN ('video', 'short')",
  })

  // Add index for filtering by type
  pgm.createIndex('videos', 'video_type', {
    name: 'idx_videos_video_type',
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropIndex('videos', 'video_type', { name: 'idx_videos_video_type' })
  pgm.dropConstraint('videos', 'videos_video_type_check')
  pgm.dropColumn('videos', 'video_type')
}
