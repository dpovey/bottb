/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * `posts` is the ledger of what we actually published, one row per
 * publication per platform.
 *
 * Naming note: the older `social_posts` / `social_post_results` pair is the
 * admin UI's *queue* — a job someone submits with a set of platforms, and its
 * per-platform attempt results. `posts` is the different thing: the record of
 * a live thing on a platform, however it got there (Graph API, a browser
 * drag, a native platform scheduler, or a human). Most Brisbane 2026 posts
 * never went through the queue at all, which is why the queue tables cannot
 * answer "what did we publish and when".
 *
 * `group_key` ties a cross-platform burst together: the six Brisbane reels
 * each went to five platforms, and the group is the unit a human thinks in.
 *
 * `posted_at_estimated` exists because we got this wrong. A posting time
 * written from a sense of elapsed time was out by two hours and had to be
 * corrected from Facebook's `created_time` and a LinkedIn snowflake id. A
 * time we read back from the platform and a time we inferred from a schedule
 * are different kinds of fact, so the column says which one this is.
 *
 * A sibling metrics workstream will add `post_metrics(post_id, captured_at,
 * ...)`; `posts.id` is a stable uuid surrogate precisely so that can hang off
 * it without depending on a platform's id shape.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable('posts', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    group_key: { type: 'varchar(255)' },
    platform: { type: 'varchar(20)', notNull: true },
    external_id: { type: 'varchar(128)' },
    permalink: { type: 'text' },
    status: { type: 'varchar(20)', notNull: true, default: 'scheduled' },
    content_type: { type: 'varchar(20)' },
    event_id: {
      type: 'varchar(255)',
      references: 'events(id)',
      onDelete: 'SET NULL',
    },
    band_id: {
      type: 'varchar(255)',
      references: 'bands(id)',
      onDelete: 'SET NULL',
    },
    video_id: { type: 'uuid', references: 'videos(id)', onDelete: 'SET NULL' },
    photo_ids: { type: 'uuid[]' },
    title: { type: 'text' },
    caption: { type: 'text' },
    collaborators: { type: 'text[]' },
    mentions: { type: 'text[]' },
    media_url: { type: 'text' },
    scheduled_for: { type: 'timestamptz' },
    posted_at: { type: 'timestamptz' },
    posted_at_estimated: { type: 'boolean', notNull: true, default: false },
    posted_tz: { type: 'varchar(64)' },
    posted_via: { type: 'varchar(20)' },
    permalink_verified_at: { type: 'timestamptz' },
    // UTM tagging, so social reach joins to website analytics in PostHog.
    //
    // Four columns rather than a jsonb blob: they are a fixed, known set, we
    // want to index and group by them, and a link builder should not have to
    // guess at key names. Captions currently link to a bare
    // battleofthetechbands.com with no parameters, which lands every platform
    // in one undifferentiated bucket.
    //
    // utm_campaign is the event slug, so it joins straight to events.id.
    // utm_source is the platform.
    // utm_medium distinguishes the LINK PLACEMENT, not just "social":
    //   Instagram captions are not clickable, so IG traffic arrives through a
    //   bio link ('social_bio') or a story sticker ('social_story'). Lumping
    //   those in with 'social' loses the only signal IG gives you.
    // utm_content is a per-post slug and is the one that does the work:
    //   referrer alone only tells you the platform, which is useless in an
    //   event week when three posts a day come from Instagram.
    //
    // Historical posts have no UTMs. Leave them null rather than inventing.
    utm_campaign: { type: 'varchar(120)' },
    utm_source: { type: 'varchar(60)' },
    utm_medium: { type: 'varchar(60)' },
    utm_content: { type: 'varchar(120)' },
    source: { type: 'varchar(64)' },
    metadata: { type: 'jsonb', notNull: true, default: '{}' },
    notes: { type: 'text' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  })

  pgm.addConstraint(
    'posts',
    'posts_platform_check',
    `CHECK (platform IN ('facebook','instagram','linkedin','tiktok','youtube','threads'))`
  )
  pgm.addConstraint(
    'posts',
    'posts_status_check',
    `CHECK (status IN ('scheduled','published','withdrawn','deleted','failed'))`
  )
  pgm.addConstraint(
    'posts',
    'posts_content_type_check',
    `CHECK (content_type IS NULL OR content_type IN ('reel','short','video','photo','carousel','story','text','link'))`
  )
  pgm.addConstraint(
    'posts',
    'posts_posted_via_check',
    `CHECK (posted_via IS NULL OR posted_via IN ('api','browser','manual','native_schedule'))`
  )
  // Deliberately NOT constrained: a published post with a null posted_at.
  // "It is live and nobody wrote down when" is a real state, and forcing a
  // time here would only make somebody invent one - which is the exact
  // mistake the Brisbane log's 2026-09-08 correction was written about.
  // `posted_at_estimated` carries the distinction that matters.

  pgm.createIndex('posts', ['platform', 'external_id'], {
    unique: true,
    name: 'posts_platform_external_id_key',
    where: 'external_id IS NOT NULL',
  })
  pgm.createIndex('posts', 'permalink', {
    unique: true,
    name: 'posts_permalink_key',
    where: 'permalink IS NOT NULL',
  })
  pgm.createIndex('posts', 'group_key')
  pgm.createIndex('posts', 'event_id')
  pgm.createIndex('posts', 'band_id')
  pgm.createIndex('posts', 'status')
  pgm.createIndex('posts', ['platform', 'posted_at'], {
    name: 'posts_platform_posted_at_idx',
  })
  pgm.createIndex('posts', 'utm_campaign')
  // utm_content is what makes a specific post attributable, so it has to be
  // unique per campaign or two posts collapse into one bucket.
  pgm.createIndex('posts', ['utm_campaign', 'utm_content'], {
    unique: true,
    name: 'posts_utm_content_key',
    where: 'utm_content IS NOT NULL',
  })

  pgm.sql(`
    CREATE OR REPLACE FUNCTION posts_set_updated_at() RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `)
  pgm.sql(`
    CREATE TRIGGER posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION posts_set_updated_at()
  `)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql('DROP TRIGGER IF EXISTS posts_updated_at ON posts')
  pgm.dropTable('posts')
  pgm.sql('DROP FUNCTION IF EXISTS posts_set_updated_at()')
}
