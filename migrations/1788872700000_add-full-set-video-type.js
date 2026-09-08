/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * Adds `full_set` as a third `video_type`.
 *
 * A band's complete performance is the most valuable video we produce, but
 * until now it shared `video_type = 'video'` with the 3-minute single-song
 * cuts, so a 27-minute set was indistinguishable from one song on a band
 * page.
 *
 * Why a third enum value rather than a separate boolean column: `video_type`
 * is already the one axis every consumer filters on (`getVideos({ videoType })`,
 * `/api/videos?type=`, the admin type filter), and a video is exactly one of
 * short / single song / full set — the categories are mutually exclusive, so a
 * second column would only make it possible to represent states that cannot
 * exist. The cost is that every caller passing `videoType: 'video'` now
 * excludes full sets; those callers are updated in the same change to ask for
 * both where they mean "long-form".
 *
 * The backfill is deliberately narrow: Melbourne 2026 shipped five complete
 * sets, all titled "(Full Set)" and all over 21 minutes. Nothing else in the
 * table sits between 379 s and 1296 s, so requiring both the title marker and
 * a 15-minute floor cannot catch a single-song video.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.dropConstraint('videos', 'videos_video_type_check')
  pgm.addConstraint('videos', 'videos_video_type_check', {
    check: "video_type IN ('video', 'short', 'full_set')",
  })

  pgm.sql(`
    UPDATE videos
    SET video_type = 'full_set'
    WHERE video_type = 'video'
      AND title ILIKE '%(full set)%'
      AND duration_seconds >= 900
  `)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql(`
    UPDATE videos
    SET video_type = 'video'
    WHERE video_type = 'full_set'
  `)

  pgm.dropConstraint('videos', 'videos_video_type_check')
  pgm.addConstraint('videos', 'videos_video_type_check', {
    check: "video_type IN ('video', 'short')",
  })
}
