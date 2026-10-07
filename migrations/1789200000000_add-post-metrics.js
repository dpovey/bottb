/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * `post_metrics` is the sibling workstream the `posts` migration anticipated:
 * one row per (post, capture), hanging off `posts.id` rather than a platform
 * id, so a post keeps its history when a platform changes its id shape.
 *
 * SNAPSHOTS, NOT CURRENT VALUES. Engagement is a moving number and age is the
 * dominant confound — a post five days old beats one five hours old on volume
 * alone. Storing a capture per collection lets age be modelled later; storing
 * only "latest" throws that away permanently and cannot be reconstructed.
 *
 * EVERY METRIC IS NULLABLE, AND NULL IS NOT ZERO. This is the important part.
 * The platforms differ in what they will tell us, and the difference is not
 * uniform:
 *   YouTube    views, likes, comments        (Data API, read-only key)
 *   Instagram  likes, comments               (no views on this token)
 *   Facebook   views on /videos; shares on /published_posts.
 *              Reactions and comments are NOT available — the token lacks
 *              `pages_read_user_content` and the call returns error 10.
 *              Verified again 22 Sep 2026, still blocked.
 *   LinkedIn   impressions/clicks/reactions exist only in the admin UI or a
 *              manual export. No API token is connected.
 *   TikTok     views/likes readable from the Studio list only. No API.
 * Writing 0 where a platform simply refuses to answer would silently turn
 * "unknown" into "nobody engaged", and every average computed afterwards
 * would be wrong in a direction nobody could see. NULL means not available.
 *
 * `source` records HOW a number was obtained, because an API read and a human
 * reading a dashboard are different kinds of fact and only one is reproducible.
 */
export const up = (pgm) => {
  pgm.createTable('post_metrics', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    post_id: {
      type: 'uuid',
      notNull: true,
      references: 'posts(id)',
      onDelete: 'CASCADE',
    },
    captured_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    views: { type: 'integer' },
    likes: { type: 'integer' },
    comments: { type: 'integer' },
    shares: { type: 'integer' },
    impressions: { type: 'integer' },
    clicks: { type: 'integer' },
    // How this capture was obtained: 'api' (reproducible) or 'manual' (a human
    // read it off a dashboard). Never treat the two as interchangeable.
    source: { type: 'varchar(20)', notNull: true, default: 'api' },
    // Raw platform payload, so a metric we did not model today is not lost.
    raw: { type: 'jsonb', notNull: true, default: '{}' },
    notes: { type: 'text' },
  })

  pgm.createIndex('post_metrics', ['post_id', 'captured_at'])
  // One capture per post per run. Re-running a collection on the same instant
  // updates rather than duplicates.
  pgm.addConstraint('post_metrics', 'post_metrics_post_captured_unique', {
    unique: ['post_id', 'captured_at'],
  })
}

export const down = (pgm) => {
  pgm.dropTable('post_metrics')
}
