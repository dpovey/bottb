import { describe, it, expect, beforeAll } from 'vitest'

/**
 * The seeded handles are facts somebody paid for in wasted time - a mention
 * that silently resolved to nothing, a collaborator invite that sat pending
 * forever. This test pins them to the migration so a later edit cannot quietly
 * lose one.
 *
 * It runs the migration's `up` against a recording stub, so it needs no
 * database.
 */

interface Recorder {
  sql: string[]
  tables: string[]
  constraints: string[]
  indexes: string[]
}

let rec: Recorder

beforeAll(async () => {
  rec = { sql: [], tables: [], constraints: [], indexes: [] }
  const pgm = {
    createTable: (name: string) => rec.tables.push(name),
    addConstraint: (t: string, n: string) => rec.constraints.push(`${t}.${n}`),
    createIndex: (t: string, c: unknown) =>
      rec.indexes.push(`${t}.${JSON.stringify(c)}`),
    sql: (s: string) => rec.sql.push(s),
    func: (s: string) => ({ literal: s }),
  }
  const mod =
    await import('../../../migrations/1788868641754_add-social-parties-and-handles.js')
  ;(mod.up as (p: unknown) => void)(pgm)
})

const seeded = (party: string, platform: string) =>
  rec.sql.find(
    (s) =>
      s.includes('INSERT INTO social_handles') &&
      s.includes(`'${party}'`) &&
      s.includes(`'${platform}'`)
  )

describe('the migration builds the tables and views', () => {
  it('creates all three tables', () => {
    expect(rec.tables).toEqual([
      'social_parties',
      'social_handles',
      'event_parties',
    ])
  })

  it('creates both flat views', () => {
    const views = rec.sql.filter((s) => s.startsWith('CREATE VIEW'))
    expect(views).toHaveLength(2)
    expect(views[0]).toContain('party_handles')
    expect(views[1]).toContain('company_handles')
  })

  it('gives the view a column per platform, so simple queries stay simple', () => {
    const view = rec.sql.find((s) => s.includes('CREATE VIEW party_handles'))!
    for (const p of [
      'linkedin',
      'facebook',
      'instagram',
      'tiktok',
      'youtube',
    ]) {
      expect(view).toContain(`AS ${p}_handle`)
      expect(view).toContain(`AS ${p}_mention_name`)
      expect(view).toContain(`AS ${p}_status`)
    }
  })

  it('does not select company_slug twice into company_handles', () => {
    // ph.* already carries it; a duplicate output name makes CREATE VIEW fail.
    const view = rec.sql.find((s) => s.includes('CREATE VIEW company_handles'))!
    expect(view).not.toContain('c.slug AS company_slug')
  })

  it('links parties to companies through a join, not a hardcoded value', () => {
    // A test database missing one of these companies must not fail the whole
    // migration, and the migration runs in a single transaction.
    const updates = rec.sql.filter((s) =>
      s.includes('UPDATE social_parties p SET company_slug')
    )
    expect(updates.length).toBeGreaterThan(0)
    for (const u of updates) expect(u).toContain('FROM companies c')
  })
})

describe('the facts that cost time to learn', () => {
  it('records the FULL registered name LinkedIn needs for Jumbo', () => {
    const row = seeded('jumbo-interactive', 'linkedin')!
    expect(row).toContain('Jumbo Interactive Limited')
    expect(row).toMatch(/FULL registered name/)
  })

  it('warns that "Rex" alone returns people, not the company', () => {
    expect(seeded('rex-software', 'linkedin')).toMatch(/returns people/)
  })

  it('marks URBAN X on LinkedIn as unknown, not none', () => {
    // The "it does not resolve" test was run in a composer whose caret was
    // jumping, so the query may never have been contiguous. That is not
    // evidence of absence.
    const row = seeded('urbanx', 'linkedin')!
    expect(row).toContain("'unknown'")
    expect(row).not.toContain("'none'")
    expect(row).toMatch(/RETEST/)
  })

  it('never invites The Triffid as an Instagram collaborator', () => {
    const row = seeded('the-triffid', 'instagram')!
    expect(row).toContain("'never'")
    expect(row).toMatch(/never accept/)
  })

  it('records that Jumbo and For The Record have no Instagram', () => {
    expect(seeded('jumbo-interactive', 'instagram')).toContain("'none'")
    expect(seeded('for-the-record', 'instagram')).toContain("'none'")
  })

  it('records that Youngcare has no TikTok, and what to use instead', () => {
    const row = seeded('youngcare', 'tiktok')!
    expect(row).toContain("'none'")
    expect(row).toContain('#youngcare')
  })

  it('keeps the videographers marked as video-only credits', () => {
    for (const p of ['aaron-griffiths', 'kurt-boldy']) {
      expect(seeded(p, 'instagram')).toMatch(/never photo posts/)
    }
  })

  it('has no handle row at all where nobody has checked', () => {
    // Absence means "never investigated". Seeding a blanket 'unknown' row for
    // every party and platform would erase that distinction, which is the
    // reason the table exists.
    expect(seeded('rex-software', 'tiktok')).toBeUndefined()
    expect(seeded('amy-corrie', 'linkedin')).toBeUndefined()
  })

  it('credits the Brisbane 2026 parties only if the event exists', () => {
    const rows = rec.sql.filter((s) => s.includes('INSERT INTO event_parties'))
    expect(rows.length).toBeGreaterThan(10)
    for (const r of rows) {
      expect(r).toContain(
        "WHERE EXISTS (SELECT 1 FROM events WHERE id = 'brisbane-2026')"
      )
    }
    expect(rows.join('\n')).toContain("'national-sponsor'")
    expect(rows.join('\n')).toContain("'venue'")
    expect(rows.join('\n')).toContain("'charity'")
  })
})
