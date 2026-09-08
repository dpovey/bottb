/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * Social identities for everyone we tag, credit or collaborate with.
 *
 * Social accounts are shared nationally (one Facebook page, one Instagram,
 * one TikTok, one YouTube channel across every city), so handles are not a
 * per-event or per-city concern. They are also not a `companies` concern:
 * sponsors, charities, venues, photographers and videographers all need the
 * same per-platform information and only some of them are companies.
 *
 * Two tables:
 *
 *   social_parties  - one row per taggable entity, with optional links back
 *                     to the companies / photographers / videographers rows
 *                     the rest of the site already uses.
 *   social_handles  - one row per (party, platform).
 *
 * `social_handles.status` is the point of the design. It distinguishes:
 *
 *   'active'   - they have an account and this is it
 *   'none'     - somebody looked and they genuinely have no account here
 *   'unknown'  - somebody looked and could not tell
 *   (no row)   - nobody has ever checked
 *
 * `mention_name` holds the full name a platform's typeahead needs, which is
 * not always the handle or the trading name. LinkedIn matches on the name as
 * LinkedIn holds it: "Jumbo Interactive Limited" resolves and "Jumbo
 * Interactive" silently returns nothing.
 *
 * `collab_policy` records whether a party accepts Instagram-style
 * collaborator invites. The Triffid never accepts them, which is worth
 * knowing before a post sits in limbo waiting for an acceptance.
 *
 * `event_parties` records who is credited on a given event's posts, with the
 * role they held there. A party's `kind` is what it intrinsically is (Jumbo
 * Interactive is a company); its role at an event is what it did there
 * (national sponsor at Brisbane 2026, and also the company behind a band).
 *
 * The `party_handles` / `company_handles` views flatten all of this back into
 * one row per party (or per company) with per-platform columns, so simple
 * lookups stay simple.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable('social_parties', {
    slug: { type: 'varchar(255)', primaryKey: true },
    kind: { type: 'varchar(20)', notNull: true },
    name: { type: 'varchar(255)', notNull: true },
    company_slug: {
      type: 'varchar(255)',
      references: 'companies(slug)',
      onDelete: 'SET NULL',
    },
    photographer_slug: {
      type: 'varchar(255)',
      references: 'photographers(slug)',
      onDelete: 'SET NULL',
    },
    videographer_slug: {
      type: 'varchar(255)',
      references: 'videographers(slug)',
      onDelete: 'SET NULL',
    },
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
    'social_parties',
    'social_parties_kind_check',
    `CHECK (kind IN ('self','company','charity','venue','sponsor','partner','photographer','videographer','person'))`
  )
  pgm.createIndex('social_parties', 'kind')
  pgm.createIndex('social_parties', 'company_slug')

  pgm.createTable('social_handles', {
    party_slug: {
      type: 'varchar(255)',
      notNull: true,
      references: 'social_parties(slug)',
      onDelete: 'CASCADE',
    },
    platform: { type: 'varchar(20)', notNull: true },
    status: { type: 'varchar(10)', notNull: true, default: 'unknown' },
    handle: { type: 'varchar(255)' },
    mention_name: { type: 'varchar(255)' },
    url: { type: 'text' },
    external_id: { type: 'varchar(64)' },
    collab_policy: { type: 'varchar(10)', notNull: true, default: 'unknown' },
    verified_at: { type: 'timestamptz' },
    verified_by: { type: 'varchar(255)' },
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

  pgm.addConstraint('social_handles', 'social_handles_pkey', {
    primaryKey: ['party_slug', 'platform'],
  })
  pgm.addConstraint(
    'social_handles',
    'social_handles_platform_check',
    `CHECK (platform IN ('facebook','instagram','linkedin','tiktok','youtube','threads'))`
  )
  pgm.addConstraint(
    'social_handles',
    'social_handles_status_check',
    `CHECK (status IN ('active','none','unknown'))`
  )
  pgm.addConstraint(
    'social_handles',
    'social_handles_collab_policy_check',
    `CHECK (collab_policy IN ('yes','never','unknown','n/a'))`
  )
  // An 'active' handle has to actually say who it is.
  pgm.addConstraint(
    'social_handles',
    'social_handles_active_has_identity_check',
    `CHECK (status <> 'active' OR handle IS NOT NULL OR mention_name IS NOT NULL OR external_id IS NOT NULL)`
  )
  pgm.createIndex('social_handles', 'platform')

  pgm.createTable('event_parties', {
    event_id: {
      type: 'varchar(255)',
      notNull: true,
      references: 'events(id)',
      onDelete: 'CASCADE',
    },
    party_slug: {
      type: 'varchar(255)',
      notNull: true,
      references: 'social_parties(slug)',
      onDelete: 'CASCADE',
    },
    role: { type: 'varchar(40)', notNull: true },
    notes: { type: 'text' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  })
  pgm.addConstraint('event_parties', 'event_parties_pkey', {
    primaryKey: ['event_id', 'party_slug', 'role'],
  })
  pgm.addConstraint(
    'event_parties',
    'event_parties_role_check',
    `CHECK (role IN ('host','national-sponsor','sponsor','charity','venue','band-company','photographer','videographer','partner','crew','judge'))`
  )
  pgm.createIndex('event_parties', 'party_slug')

  pgm.sql(PARTY_HANDLES_VIEW_SQL)
  pgm.sql(COMPANY_HANDLES_VIEW_SQL)

  seed(pgm)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql('DROP VIEW IF EXISTS company_handles')
  pgm.sql('DROP VIEW IF EXISTS party_handles')
  pgm.dropTable('event_parties')
  pgm.dropTable('social_handles')
  pgm.dropTable('social_parties')
}

// ---------------------------------------------------------------------------
// Views: the flat, one-row-per-party shape.
// ---------------------------------------------------------------------------

const VIEW_PLATFORMS = [
  'linkedin',
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
]

const viewColumns = VIEW_PLATFORMS.flatMap((p) => [
  `  MAX(h.status) FILTER (WHERE h.platform = '${p}') AS ${p}_status`,
  `  MAX(h.handle) FILTER (WHERE h.platform = '${p}') AS ${p}_handle`,
  `  MAX(h.mention_name) FILTER (WHERE h.platform = '${p}') AS ${p}_mention_name`,
  `  MAX(h.url) FILTER (WHERE h.platform = '${p}') AS ${p}_url`,
  `  MAX(h.collab_policy) FILTER (WHERE h.platform = '${p}') AS ${p}_collab_policy`,
]).join(',\n')

export const PARTY_HANDLES_VIEW_SQL = `CREATE VIEW party_handles AS
SELECT
  p.slug AS party_slug,
  p.kind,
  p.name,
  p.company_slug,
  p.photographer_slug,
  p.videographer_slug,
${viewColumns}
FROM social_parties p
LEFT JOIN social_handles h ON h.party_slug = p.slug
GROUP BY p.slug, p.kind, p.name, p.company_slug, p.photographer_slug, p.videographer_slug`

// ph.* already carries company_slug, so selecting c.slug under the same name
// would make CREATE VIEW fail on a duplicate column.
export const COMPANY_HANDLES_VIEW_SQL = `CREATE VIEW company_handles AS
SELECT
  c.name AS company_name,
  ph.*
FROM companies c
JOIN party_handles ph ON ph.company_slug = c.slug`

// ---------------------------------------------------------------------------
// Seed: the handles verified in August/September 2026, from
// doc/production/social-reel-posting-runbook.md and
// doc/production/brisbane-2026-reel-posts.md.
//
// Only facts we actually have are seeded. A missing row means nobody has
// checked that platform for that party; it does not mean "no account".
// ---------------------------------------------------------------------------

const PARTIES = [
  ['bottb', 'self', 'Battle of the Tech Bands', null],
  ['jumbo-interactive', 'company', 'Jumbo Interactive', 'jumbo-interactive'],
  ['youngcare', 'charity', 'Youngcare', null],
  ['rex-software', 'company', 'Rex Software', 'rex-software'],
  ['urbanx', 'company', 'URBAN X', 'urbanx'],
  ['epsilon', 'company', 'Epsilon', 'epsilon'],
  ['suncorp', 'company', 'Suncorp', 'suncorp'],
  ['for-the-record', 'company', 'For The Record', 'for-the-record'],
  ['the-triffid', 'venue', 'The Triffid', null],
  ['amy-corrie', 'photographer', 'Amy Corrie', null],
  ['aaron-griffiths', 'videographer', 'Aaron Griffiths', null],
  ['kurt-boldy', 'videographer', 'Kurt Boldy', null],
]

const VERIFIED = '2026-08-31'
const RUNBOOK = 'social-reel-posting-runbook.md'

/**
 * party, platform, status, handle, mention_name, url, external_id,
 * collab_policy, notes
 */
const HANDLES = [
  // --- BotTB itself -------------------------------------------------------
  [
    'bottb',
    'linkedin',
    'active',
    'battle-of-the-tech-bands',
    'Battle of the Tech Bands',
    'https://www.linkedin.com/company/battle-of-the-tech-bands/',
    null,
    'n/a',
    null,
  ],
  [
    'bottb',
    'facebook',
    'active',
    'battleofthetechbands',
    'Battle of the Tech Bands',
    'https://www.facebook.com/battleofthetechbands',
    '207312765803305',
    'n/a',
    'Page id 207312765803305 is what the Graph API posts as.',
  ],
  [
    'bottb',
    'instagram',
    'active',
    'battleofthetechbands',
    'Battle of the Tech Bands',
    'https://www.instagram.com/battleofthetechbands/',
    '17841461862790198',
    'n/a',
    'external_id is the IG business account id used by the Graph API.',
  ],
  [
    'bottb',
    'tiktok',
    'active',
    'bottb0',
    'Battle of the Tech Bands',
    'https://www.tiktok.com/@bottb0',
    null,
    'n/a',
    null,
  ],
  [
    'bottb',
    'youtube',
    'active',
    'battleofthetechbands',
    'Battle of the Tech Bands',
    'https://www.youtube.com/@battleofthetechbands',
    null,
    'n/a',
    null,
  ],

  // --- National sponsor ---------------------------------------------------
  [
    'jumbo-interactive',
    'linkedin',
    'active',
    'jumbo-interactive-limited',
    'Jumbo Interactive Limited',
    'https://www.linkedin.com/company/jumbo-interactive-limited/',
    null,
    'n/a',
    'Mention needs the FULL registered name. "@Jumbo Interactive Limited" resolves (Dean, 7 Sep 2026, and again on the The Chain post); "@Jumbo Interactive" does not.',
  ],
  [
    'jumbo-interactive',
    'facebook',
    'active',
    'JumboInteractive',
    'Jumbo Interactive',
    'https://www.facebook.com/JumboInteractive',
    null,
    'n/a',
    null,
  ],
  [
    'jumbo-interactive',
    'instagram',
    'none',
    null,
    null,
    null,
    null,
    'n/a',
    'No Instagram account. Use the name as plain text.',
  ],
  [
    'jumbo-interactive',
    'tiktok',
    'none',
    null,
    null,
    null,
    null,
    'n/a',
    'Not found Aug 2026; name-only on TikTok.',
  ],
  [
    'jumbo-interactive',
    'youtube',
    'none',
    null,
    null,
    null,
    null,
    'n/a',
    'Not found Aug 2026.',
  ],

  // --- Charity ------------------------------------------------------------
  [
    'youngcare',
    'linkedin',
    'active',
    'youngcareoz',
    'Youngcare',
    'https://www.linkedin.com/company/youngcareoz/',
    null,
    'n/a',
    null,
  ],
  [
    'youngcare',
    'facebook',
    'active',
    'YoungcareOz',
    'Youngcare Australia',
    'https://www.facebook.com/YoungcareOz',
    null,
    'n/a',
    '48K followers.',
  ],
  [
    'youngcare',
    'instagram',
    'active',
    'youngcareoz',
    'Youngcare',
    'https://www.instagram.com/youngcareoz/',
    null,
    'yes',
    null,
  ],
  [
    'youngcare',
    'tiktok',
    'none',
    null,
    null,
    null,
    null,
    'n/a',
    'No TikTok account. Use #youngcare instead.',
  ],
  [
    'youngcare',
    'youtube',
    'active',
    'YoungcareOz',
    'Youngcare',
    'https://www.youtube.com/@YoungcareOz',
    null,
    'n/a',
    null,
  ],

  // --- Band companies -----------------------------------------------------
  [
    'rex-software',
    'linkedin',
    'active',
    'rex-software',
    'Rex Software',
    'https://www.linkedin.com/company/rex-software/',
    null,
    'n/a',
    '"@Rex" alone returns people, not the company. Type the full "Rex Software".',
  ],
  [
    'rex-software',
    'facebook',
    'active',
    'rexsoftware',
    'Rex Software',
    'https://www.facebook.com/rexsoftware',
    null,
    'n/a',
    null,
  ],
  [
    'rex-software',
    'instagram',
    'active',
    'rex_software',
    'Rex Software',
    'https://www.instagram.com/rex_software/',
    null,
    'yes',
    'Accepted collaborator invites on the Brisbane 2026 reels.',
  ],

  [
    'urbanx',
    'linkedin',
    'unknown',
    'urbanx',
    'URBAN X',
    null,
    null,
    'n/a',
    'Status deliberately unknown. A 7 Sep 2026 "test" that @URBAN X does not resolve was run in a composer whose caret was silently jumping, so the query may never have been contiguous. RETEST before falling back to plain text; try "URBANX" and the full registered name.',
  ],
  [
    'urbanx',
    'facebook',
    'active',
    'URBANX.IO',
    'URBAN X',
    'https://www.facebook.com/URBANX.IO',
    null,
    'n/a',
    null,
  ],
  [
    'urbanx',
    'instagram',
    'active',
    'urbanx.io',
    'URBAN X',
    'https://www.instagram.com/urbanx.io/',
    null,
    'yes',
    'Accepted collaborator invites on the Brisbane 2026 reels.',
  ],

  [
    'epsilon',
    'linkedin',
    'active',
    'epsilon',
    'Epsilon',
    'https://www.linkedin.com/company/epsilon/',
    null,
    'n/a',
    null,
  ],
  [
    'epsilon',
    'facebook',
    'active',
    'EpsilonMarketing',
    'Epsilon',
    'https://www.facebook.com/EpsilonMarketing',
    null,
    'n/a',
    'Global account, not the ANZ team.',
  ],
  [
    'epsilon',
    'instagram',
    'active',
    'epsilonmarketing',
    'Epsilon',
    'https://www.instagram.com/epsilonmarketing/',
    null,
    'yes',
    'Global account. Accepted the Epsonics photo-post collaborator invite 8 Sep 2026.',
  ],

  [
    'suncorp',
    'linkedin',
    'active',
    'suncorp',
    'Suncorp Group',
    'https://www.linkedin.com/company/suncorp/',
    null,
    'n/a',
    'Mention name is "Suncorp Group", not "Suncorp".',
  ],
  [
    'suncorp',
    'facebook',
    'active',
    'suncorpAUNZ',
    'Suncorp',
    'https://www.facebook.com/suncorpAUNZ',
    null,
    'n/a',
    '62K followers. facebook.com/SunCorp is somebody else.',
  ],
  [
    'suncorp',
    'instagram',
    'active',
    'suncorp',
    'Suncorp',
    'https://www.instagram.com/suncorp/',
    null,
    'unknown',
    null,
  ],

  [
    'for-the-record',
    'linkedin',
    'active',
    'ftr-limited',
    'For The Record (FTR)',
    'https://www.linkedin.com/company/ftr-limited/',
    null,
    'n/a',
    'Mention name is "For The Record (FTR)".',
  ],
  [
    'for-the-record',
    'facebook',
    'none',
    null,
    null,
    null,
    null,
    'n/a',
    'Not found Aug 2026; their site lists LinkedIn and YouTube only.',
  ],
  [
    'for-the-record',
    'instagram',
    'none',
    null,
    null,
    null,
    null,
    'n/a',
    'No Instagram account.',
  ],
  [
    'for-the-record',
    'youtube',
    'active',
    null,
    'For The Record',
    'https://www.youtube.com/channel/UCjuxl4U96wR_31c4-REZPhw',
    'UCjuxl4U96wR_31c4-REZPhw',
    'n/a',
    'Channel id only; no vanity handle found.',
  ],

  // --- Venue --------------------------------------------------------------
  [
    'the-triffid',
    'facebook',
    'active',
    'thetriffid',
    'The Triffid',
    'https://www.facebook.com/thetriffid',
    null,
    'n/a',
    null,
  ],
  [
    'the-triffid',
    'instagram',
    'active',
    'thetriffid',
    'The Triffid',
    'https://www.instagram.com/thetriffid/',
    null,
    'never',
    'Do NOT invite as an Instagram collaborator. They never accept, and the post sits pending. Tag them in the caption instead.',
  ],
  [
    'the-triffid',
    'linkedin',
    'unknown',
    null,
    null,
    null,
    null,
    'n/a',
    'No LinkedIn page found, but not exhaustively checked.',
  ],
  [
    'the-triffid',
    'tiktok',
    'unknown',
    null,
    'The Triffid',
    null,
    null,
    'unknown',
    'The Triffid exists as a TikTok LOCATION and is used as the post location. Whether they have an account to tag has not been established.',
  ],

  // --- Crew ---------------------------------------------------------------
  [
    'amy-corrie',
    'instagram',
    'active',
    'amyjuliaaaaa',
    'Amy Corrie',
    'https://www.instagram.com/amyjuliaaaaa/',
    null,
    'yes',
    'Brisbane 2026 stills. Credit line: "Photos by Amy Corrie". Collaborator use approved by Dean 7 Sep 2026.',
  ],
  [
    'aaron-griffiths',
    'instagram',
    'active',
    'quirkylikethat',
    'Aaron Griffiths',
    'https://www.instagram.com/quirkylikethat/',
    null,
    'yes',
    'Videographer. Credit on VIDEO posts only, never photo posts.',
  ],
  [
    'kurt-boldy',
    'instagram',
    'active',
    'kurtboldy',
    'Kurt Boldy',
    'https://www.instagram.com/kurtboldy/',
    null,
    'yes',
    'Videographer. Credit on VIDEO posts only, never photo posts.',
  ],
]

const EVENT_PARTIES = [
  ['bottb', 'host'],
  ['jumbo-interactive', 'national-sponsor'],
  ['jumbo-interactive', 'band-company'],
  ['youngcare', 'charity'],
  ['the-triffid', 'venue'],
  ['rex-software', 'band-company'],
  ['urbanx', 'band-company'],
  ['epsilon', 'band-company'],
  ['suncorp', 'band-company'],
  ['for-the-record', 'band-company'],
  ['amy-corrie', 'photographer'],
  ['aaron-griffiths', 'videographer'],
  ['kurt-boldy', 'videographer'],
]

const lit = (v) =>
  v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
function seed(pgm) {
  for (const [slug, kind, name, companySlug] of PARTIES) {
    // company_slug is set through a join so the migration still applies on a
    // database that is missing one of these companies (test DBs, older dumps).
    pgm.sql(
      `INSERT INTO social_parties (slug, kind, name) VALUES (${lit(slug)}, ${lit(kind)}, ${lit(name)}) ON CONFLICT (slug) DO NOTHING`
    )
    if (companySlug) {
      pgm.sql(
        `UPDATE social_parties p SET company_slug = c.slug FROM companies c WHERE c.slug = ${lit(companySlug)} AND p.slug = ${lit(slug)}`
      )
    }
  }

  // Link the crew parties to their photographers/videographers rows by name,
  // if those rows exist. Same reason: never fail on a database that lacks them.
  pgm.sql(
    `UPDATE social_parties p SET photographer_slug = g.slug FROM photographers g WHERE p.kind = 'photographer' AND g.name = p.name`
  )
  pgm.sql(
    `UPDATE social_parties p SET videographer_slug = g.slug FROM videographers g WHERE p.kind = 'videographer' AND g.name = p.name`
  )

  for (const [
    party,
    platform,
    status,
    handle,
    mention,
    url,
    externalId,
    collab,
    notes,
  ] of HANDLES) {
    pgm.sql(`INSERT INTO social_handles (party_slug, platform, status, handle, mention_name, url, external_id, collab_policy, verified_at, verified_by, notes)
VALUES (${lit(party)}, ${lit(platform)}, ${lit(status)}, ${lit(handle)}, ${lit(mention)}, ${lit(url)}, ${lit(externalId)}, ${lit(collab)}, ${lit(VERIFIED)}::timestamptz, ${lit(RUNBOOK)}, ${lit(notes)})
ON CONFLICT (party_slug, platform) DO NOTHING`)
  }

  for (const [party, role] of EVENT_PARTIES) {
    pgm.sql(`INSERT INTO event_parties (event_id, party_slug, role)
SELECT 'brisbane-2026', ${lit(party)}, ${lit(role)}
WHERE EXISTS (SELECT 1 FROM events WHERE id = 'brisbane-2026')
ON CONFLICT DO NOTHING`)
  }
}
