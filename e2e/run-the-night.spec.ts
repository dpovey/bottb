import {
  test,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
  type PlaywrightWorkerArgs,
} from '@playwright/test'

/**
 * End-to-end rehearsal of a whole night, driven through the real UI against a
 * real database: open crowd voting, vote from several "phones", close voting,
 * review held votes, enter judge sheets, finalise, release — and every undo.
 *
 * It runs on the rehearsal ("test") event, which the first test creates from
 * the admin dashboard exactly as an operator would.
 *
 * The expected scores are worked out in this file from the votes and judge
 * sheets it submits, independently of the app's scoring code.
 *
 * Prerequisites:
 * - Test database seeded with the admin user (admin@test.com / testpassword123)
 */

const EVENT_ID = 'test-night'
const RUN_URL = `/admin/events/${EVENT_ID}/run`
const NIGHT_API = `/api/events/${EVENT_ID}/night`
const BASE_URL = 'http://localhost:3001'

const BANDS = [
  'The Dry Runs',
  'Soundcheck Sally',
  'Null Pointer Sisters',
  'Merge Conflict',
  'Rollback Kings',
]
const bandId = (n: number) => `${EVENT_ID}-band-${n}`

/** [song choice, performance, crowd vibe, visuals] per band, in running order. */
const JUDGE_SHEETS: Record<string, number[][]> = {
  'Judge One': [
    [15, 16, 17, 18],
    [18, 18, 18, 18],
    [10, 11, 12, 13],
    [20, 20, 20, 20],
    [12, 12, 12, 12],
  ],
  'Judge Two': [
    [14, 15, 16, 17],
    [17, 18, 19, 20],
    [11, 11, 11, 11],
    [19, 18, 17, 16],
    [13, 14, 15, 16],
  ],
  'Judge Three': [
    [16, 17, 18, 19],
    [16, 15, 14, 13],
    [12, 14, 16, 18],
    [18, 19, 20, 17],
    [10, 10, 10, 10],
  ],
}

/** Crowd votes that should end up counted, per band, once review is done. */
const COUNTED_VOTES = [4, 2, 2, 1, 1]
/** Scoring version 2026.2: the crowd vote is worth 20, the leader gets all 20. */
const CROWD_WEIGHT = 20

function expectedTotals(): number[] {
  const judges = Object.values(JUDGE_SHEETS)
  const mostVotes = Math.max(...COUNTED_VOTES)
  return BANDS.map((_, band) => {
    const judgeAverage =
      judges.reduce(
        (sum, sheet) => sum + sheet[band].reduce((a, b) => a + b, 0),
        0
      ) / judges.length
    return judgeAverage + (COUNTED_VOTES[band] / mostVotes) * CROWD_WEIGHT
  })
}

interface NightStateSnapshot {
  event: { status: string; isTest: boolean }
  crowd: {
    total: { approved: number; pending: number; rejected: number }
    byBand: Record<
      string,
      { approved: number; pending: number; rejected: number }
    >
  }
  reviewQueue: {
    vote: { id: string; band_id: string }
    suggestion: 'approve' | 'reject'
  }[]
  reviewed: { id: string; band_id: string; status: string }[]
  judges: { name: string; bandsScored: number }[]
  standings: { band_name: string; rank: number; totalScore: number }[]
  standingsFrozen: boolean
  transitions: { id: string; blockers: string[]; warnings: string[] }[]
}

async function login(page: Page) {
  await page.goto('/admin/login')
  await page.getByPlaceholder('you@example.com').fill('admin@test.com')
  await page.getByPlaceholder('••••••••').fill('testpassword123')
  await page.getByRole('button', { name: /Sign In/i }).click()
  await expect(page).toHaveURL('/admin', { timeout: 30000 })
}

async function nightState(page: Page): Promise<NightStateSnapshot> {
  const response = await page.request.get(NIGHT_API)
  expect(response.status()).toBe(200)
  return (await response.json()) as NightStateSnapshot
}

/** The big heading on the "Run the night" page naming the current phase. */
function phaseHeading(page: Page, label: string) {
  return page.getByRole('heading', { level: 2, name: label, exact: true })
}

/** Press a lifecycle button, confirm in the dialog, and wait for the new phase. */
async function takeStep(page: Page, button: string, nextPhase: string) {
  await page.getByRole('button', { name: button, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Test Night (rehearsal)')
  await dialog
    .getByRole('button', { name: `Yes, ${button.toLowerCase()}`, exact: true })
    .click()
  await expect(phaseHeading(page, nextPhase)).toBeVisible({ timeout: 30000 })
  await expect(dialog).toBeHidden()
}

test.describe('Run the night', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 })

  let adminContext: BrowserContext
  let admin: Page
  /** Contexts for members of the public: no admin session. */
  let voterContext: BrowserContext
  let voter: Page
  let lateContext: BrowserContext
  let lateVoter: Page
  const phones: APIRequestContext[] = []

  /**
   * A phone voting straight at the API, with its own address, browser and
   * (optionally) the browser fingerprint an identical handset would share.
   */
  async function phoneVote(
    playwright: PlaywrightWorkerArgs['playwright'],
    phone: { ip: string; userAgent: string },
    body: Record<string, unknown>
  ) {
    const context = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: {
        'User-Agent': phone.userAgent,
        'X-Forwarded-For': phone.ip,
      },
    })
    phones.push(context)
    return context.post('/api/votes', {
      data: { event_id: EVENT_ID, voter_type: 'crowd', ...body },
    })
  }

  test.beforeAll(async ({ browser }) => {
    // Each actor has its own browser string, as real devices do. (It also
    // keeps this spec's traffic out of the other specs' rate-limit budget.)
    adminContext = await browser.newContext({
      userAgent: 'Mozilla/5.0 (E2E night admin)',
    })
    admin = await adminContext.newPage()
    voterContext = await browser.newContext({
      userAgent: 'Mozilla/5.0 (E2E night voter)',
    })
    voter = await voterContext.newPage()
    lateContext = await browser.newContext({
      userAgent: 'Mozilla/5.0 (E2E late voter)',
    })
    lateVoter = await lateContext.newPage()
    await login(admin)
  })

  test.afterAll(async () => {
    // Leave the rehearsal event clean for the next run.
    await admin.request
      .post(`${NIGHT_API}/test`, { data: { action: 'reset' } })
      .catch(() => undefined)
    await Promise.all(phones.map((phone) => phone.dispose()))
    await adminContext.close()
    await voterContext.close()
    await lateContext.close()
  })

  test('the test event is created from the dashboard and starts before voting', async () => {
    await admin.goto('/admin')
    await admin
      .getByRole('button', { name: 'Rehearse with test event' })
      .click()
    await expect(admin).toHaveURL(RUN_URL, { timeout: 30000 })

    // Start from a clean slate even if an earlier run left votes behind.
    const reset = await admin.request.post(`${NIGHT_API}/test`, {
      data: { action: 'reset' },
    })
    expect(reset.status()).toBe(200)
    await admin.reload()

    await expect(phaseHeading(admin, 'Before voting')).toBeVisible()
    await expect(admin.getByText('Rehearsal.')).toBeVisible()
    await expect(
      admin
        .getByRole('list', { name: 'Progress through the night' })
        .locator('[aria-current="step"]')
    ).toContainText('Before voting')

    const state = await nightState(admin)
    expect(state.event).toMatchObject({ status: 'upcoming', isTest: true })
    expect(state.crowd.total).toEqual({ approved: 0, pending: 0, rejected: 0 })
  })

  test('the test event is hidden from every public listing', async () => {
    for (const path of ['/', '/events']) {
      await voter.goto(path)
      await expect(voter.locator('body')).not.toContainText('Test Night')
    }
    for (const path of [
      '/api/events/upcoming',
      '/api/events/past',
      '/api/events/active',
      '/sitemap.xml',
    ]) {
      const response = await voter.request.get(path)
      expect(response.ok(), `${path} should load`).toBe(true)
      expect(await response.text(), `${path} must not list it`).not.toContain(
        EVENT_ID
      )
    }
  })

  test('past results and real events are protected from the tools on this page', async () => {
    // A past event, finalised before this page existed: its results cannot be
    // taken down or unlocked (that would recalculate and replace them).
    const past = await adminContext.newPage()
    await past.goto('/admin/events/test-finalized-event/run')
    await expect(phaseHeading(past, 'Results released')).toBeVisible({
      timeout: 30000,
    })
    await expect(
      past.getByRole('button', { name: 'Take results down' })
    ).toHaveCount(0)
    await expect(
      past.getByText(/finalised before "Run the night" existed/)
    ).toBeVisible()
    await past.close()
    const takeDown = await admin.request.post(
      '/api/events/test-finalized-event/night/transition',
      { data: { transition: 'unrelease-results' } }
    )
    expect(takeDown.status()).toBe(422)

    // The old "set status" endpoint changes nothing any more.
    const legacy = await admin.request.patch(
      '/api/events/test-finalized-event/status',
      { data: { status: 'upcoming' } }
    )
    expect(legacy.status()).toBe(410)
    // Nor can scores be wiped once an event is past "before voting".
    const wipe = await admin.request.delete(
      '/api/events/test-finalized-event/clear-scores'
    )
    expect(wipe.status()).toBe(409)
    const still = await voter.request.get(
      '/api/events/test-finalized-event/scores'
    )
    expect(still.status()).toBe(200)
    expect(((await still.json()) as unknown[]).length).toBeGreaterThan(0)
  })

  test('rehearsal tools and admin APIs are closed to the public and to real events', async () => {
    // Not signed in: no state, no transitions.
    const anonState = await voter.request.get(NIGHT_API)
    expect(anonState.status()).toBe(401)
    const anonStep = await voter.request.post(`${NIGHT_API}/transition`, {
      data: { transition: 'open-voting' },
    })
    expect(anonStep.status()).toBe(401)

    // Signed in, but aimed at a real event: the rehearsal tools refuse.
    for (const action of ['reset', 'simulate-crowd', 'simulate-judges']) {
      const response = await admin.request.post(
        '/api/events/test-voting-event/night/test',
        { data: { action } }
      )
      expect(response.status(), `${action} on a real event`).toBe(403)
    }
  })

  test('before voting opens the ballot is closed', async ({ playwright }) => {
    await voter.goto(`/vote/crowd/${EVENT_ID}`)
    await expect(
      voter.getByRole('heading', { name: 'Voting Opens Soon' })
    ).toBeVisible()

    const early = await phoneVote(
      playwright,
      { ip: '198.51.100.1', userAgent: 'E2E early bird' },
      { band_id: bandId(1) }
    )
    expect(early.status()).toBe(403)
    expect((await nightState(admin)).crowd.total.approved).toBe(0)
  })

  test('opening voting puts the ballot on phones that were already waiting', async () => {
    await takeStep(admin, 'Open crowd voting', 'Voting open')

    // No reload: the waiting page notices by itself.
    await expect(
      voter.getByRole('heading', { name: 'Select Your Favorite Band' })
    ).toBeVisible({ timeout: 30000 })
    for (const band of BANDS) {
      await expect(voter.getByText(band, { exact: true })).toBeVisible()
    }

    // A second phone sits on the ballot without voting, for later.
    await lateVoter.goto(`/vote/crowd/${EVENT_ID}`)
    await expect(
      lateVoter.getByRole('heading', { name: 'Select Your Favorite Band' })
    ).toBeVisible({ timeout: 30000 })
  })

  test('a voter can vote and then change their own vote only', async ({
    playwright,
  }) => {
    // Another phone votes first, so there is somebody else's vote to protect.
    const other = await phoneVote(
      playwright,
      { ip: '198.51.100.2', userAgent: 'E2E phone B' },
      {
        band_id: bandId(1),
        fingerprintjs_visitor_id: 'e2e-handset-model-1',
        email: 'b@example.com',
      }
    )
    expect(other.status()).toBe(200)

    await voter.getByText('The Dry Runs', { exact: true }).click()
    await voter.getByRole('button', { name: 'Submit Vote' }).click()
    await expect(
      voter.getByRole('heading', { name: 'Vote Submitted!' })
    ).toBeVisible({ timeout: 30000 })

    let state = await nightState(admin)
    expect(state.crowd.byBand[bandId(1)].approved).toBe(2)

    // Coming back, the page remembers the vote and offers to change it.
    await voter.goto(`/vote/crowd/${EVENT_ID}`)
    await expect(voter.getByText('You previously voted for')).toBeVisible({
      timeout: 30000,
    })
    await voter.getByText('Soundcheck Sally', { exact: true }).click()
    await voter.getByRole('button', { name: 'Update Vote' }).click()
    await expect(
      voter.getByRole('heading', { name: 'Vote Submitted!' })
    ).toBeVisible({ timeout: 30000 })

    // Exactly one vote moved; phone B's vote is untouched.
    state = await nightState(admin)
    expect(state.crowd.total).toEqual({ approved: 2, pending: 0, rejected: 0 })
    expect(state.crowd.byBand[bandId(1)].approved).toBe(1)
    expect(state.crowd.byBand[bandId(2)].approved).toBe(1)
  })

  test('votes that look like repeats are held for review, never lost and never silently counted', async ({
    playwright,
  }) => {
    // An identical phone on phone B's connection (same address, same browser,
    // no cookie). It could be B again or the person next to them, so it is
    // kept and held: the second such phone gets the benefit of the doubt.
    const identical = await phoneVote(
      playwright,
      { ip: '198.51.100.2', userAgent: 'E2E phone B' },
      { band_id: bandId(3), fingerprintjs_visitor_id: 'e2e-handset-model-1' }
    )
    expect(identical.status()).toBe(201)
    expect((await identical.json()).status).toBe('pending')

    // An identical handset on a different connection: held, suggest approve.
    const twin = await phoneVote(
      playwright,
      { ip: '198.51.100.3', userAgent: 'E2E phone C' },
      { band_id: bandId(1), fingerprintjs_visitor_id: 'e2e-handset-model-1' }
    )
    expect(twin.status()).toBe(201)
    expect((await twin.json()).status).toBe('pending')

    // A third vote from that handset on phone B's connection: held, and by
    // now it looks like the same phone voting again, so suggest reject.
    const third = await phoneVote(
      playwright,
      { ip: '198.51.100.2', userAgent: 'E2E phone D' },
      { band_id: bandId(5), fingerprintjs_visitor_id: 'e2e-handset-model-1' }
    )
    expect(third.status()).toBe(201)

    // Phone B's email again from a different phone: held, suggest reject.
    const sameEmail = await phoneVote(
      playwright,
      { ip: '198.51.100.4', userAgent: 'E2E phone F' },
      { band_id: bandId(4), email: ' B@Example.com ' }
    )
    expect(sameEmail.status()).toBe(201)

    // A member of the public cannot post judge scores: it is just a crowd vote.
    const fakeJudge = await phoneVote(
      playwright,
      { ip: '198.51.100.5', userAgent: 'E2E phone J' },
      {
        band_id: bandId(5),
        voter_type: 'judge',
        name: 'Fake Judge',
        song_choice: 20,
        performance: 20,
        crowd_vibe: 20,
        visuals: 20,
      }
    )
    expect(fakeJudge.status()).toBe(200)

    // A band from another event is refused.
    const wrongBand = await phoneVote(
      playwright,
      { ip: '198.51.100.6', userAgent: 'E2E phone W' },
      { band_id: 'test-band-1' }
    )
    expect(wrongBand.status()).toBe(400)

    // Ordinary votes from five more distinct phones.
    const ordinary = [1, 1, 2, 3, 4]
    for (const [index, band] of ordinary.entries()) {
      const response = await phoneVote(
        playwright,
        { ip: `198.51.100.${20 + index}`, userAgent: `E2E crowd ${index}` },
        { band_id: bandId(band) }
      )
      expect(response.status()).toBe(200)
    }

    // Bad signal: a phone's vote is saved but the answer never arrives, so it
    // has no cookie and the voter taps again (here even changing their mind).
    // The page sends the same vote id each time, so it stays one vote.
    const flakyPhone = { ip: '198.51.100.20', userAgent: 'E2E crowd 0' }
    const before = await nightState(admin)
    const retry = await phoneVote(playwright, flakyPhone, {
      band_id: bandId(2),
      client_vote_id: '5f0c2b1e-8a43-4c7d-9b1a-3e2f6d7c8a90',
    })
    // That id is new to the server, and this phone has already voted: held.
    expect(retry.status()).toBe(201)
    const retryAgain = await phoneVote(playwright, flakyPhone, {
      band_id: bandId(1),
      client_vote_id: '5f0c2b1e-8a43-4c7d-9b1a-3e2f6d7c8a90',
    })
    expect(retryAgain.status()).toBe(201)
    expect((await retryAgain.json()).id).toBe((await retry.json()).id)
    const afterRetry = await nightState(admin)
    expect(afterRetry.crowd.total.pending).toBe(before.crowd.total.pending + 1)
    // Reject it here so the rest of the night's arithmetic is unaffected.
    const rejected = await admin.request.patch(`${NIGHT_API}/votes`, {
      data: { status: 'rejected', voteIds: [(await retry.json()).id] },
    })
    expect(rejected.status()).toBe(200)

    const state = await nightState(admin)
    expect(state.judges).toEqual([])
    expect(state.crowd.total).toEqual({ approved: 8, pending: 4, rejected: 1 })
    const suggestions = Object.fromEntries(
      state.reviewQueue.map((item) => [item.vote.band_id, item.suggestion])
    )
    expect(suggestions).toEqual({
      [bandId(3)]: 'approve', // second identical phone on B's connection
      [bandId(1)]: 'approve', // identical handset elsewhere
      [bandId(5)]: 'reject', // third from that handset on B's connection
      [bandId(4)]: 'reject', // B's email again
    })

    // The operator's screen picks the new votes up without a reload.
    await expect(admin.getByLabel('Votes cast')).toHaveText('13', {
      timeout: 30000,
    })
  })

  test('closing voting stops votes everywhere at once', async ({
    playwright,
  }) => {
    await takeStep(admin, 'Close crowd voting', 'Voting closed')

    // The phone still sitting on the ballot is told, without a reload.
    await expect(
      lateVoter.getByRole('heading', { name: 'Voting Has Closed' })
    ).toBeVisible({ timeout: 30000 })

    const tooLate = await phoneVote(
      playwright,
      { ip: '198.51.100.40', userAgent: 'E2E too late' },
      { band_id: bandId(1) }
    )
    expect(tooLate.status()).toBe(403)
    expect((await nightState(admin)).crowd.total.approved).toBe(8)
  })

  test('results cannot be finalised until held votes and judges are dealt with', async () => {
    const finalise = admin.getByRole('button', {
      name: 'Finalise results',
      exact: true,
    })
    await expect(finalise).toBeDisabled()
    const blockers = admin.getByRole('list', {
      name: 'Before you can continue',
    })
    await expect(blockers).toContainText('4 held votes still need a decision')
    await expect(blockers).toContainText('No judge scores have been entered')

    // The API refuses too, whatever the button says.
    const forced = await admin.request.post(`${NIGHT_API}/transition`, {
      data: { transition: 'lock-results' },
    })
    expect(forced.status()).toBe(422)
    expect((await nightState(admin)).event.status).toBe('closed')
  })

  test('held votes are reviewed blind, in bulk and one at a time', async () => {
    await expect(
      admin.getByRole('heading', { name: /Held votes\s*\(4\)/ })
    ).toBeVisible()
    // Band names stay off the review list until scores are switched on.
    await expect(
      admin.getByRole('list', { name: 'Held votes', exact: true })
    ).not.toContainText('Null Pointer Sisters')

    // Held votes are grouped by what they share. The two from phone B's
    // address sit together and can be decided together; the others stand
    // alone, so they only have their own buttons.
    await expect(
      admin.getByRole('heading', {
        name: '2 held votes from one IP address',
        exact: true,
      })
    ).toBeVisible()
    await expect(
      admin.getByRole('button', { name: /^Approve these 2 \(198\.51\.100\.2 / })
    ).toBeVisible()
    await expect(
      admin.getByRole('button', { name: /^Reject these 2 \(198\.51\.100\.2 / })
    ).toBeVisible()
    await expect(
      admin.getByRole('heading', {
        name: '1 held vote with an email address already used',
      })
    ).toBeVisible()
    await expect(
      admin.getByRole('button', { name: /^Approve these 1/ })
    ).toHaveCount(0)

    await admin
      .getByRole('button', {
        name: 'Follow suggestions (2 approve · 2 reject)',
      })
      .click()
    await expect(
      admin.getByText('Nothing waiting for a decision.')
    ).toBeVisible({ timeout: 30000 })

    let state = await nightState(admin)
    expect(state.crowd.total).toEqual({ approved: 10, pending: 0, rejected: 3 })
    expect(state.crowd.byBand[bandId(1)].approved).toBe(4)

    // Second thoughts on the same-email one: undo it, look again, reject it.
    const rejectedBand4 = state.reviewed.find(
      (vote) => vote.band_id === bandId(4) && vote.status === 'rejected'
    )
    expect(rejectedBand4).toBeTruthy()
    await admin.getByText(/Already decided \(5\)/).click()
    await admin
      .getByRole('button', {
        name: `Undo decision on vote ${rejectedBand4!.id}`,
      })
      .click()
    await expect(
      admin.getByRole('heading', { name: /Held votes\s*\(1\)/ })
    ).toBeVisible({ timeout: 30000 })
    expect((await nightState(admin)).crowd.total).toEqual({
      approved: 10,
      pending: 1,
      rejected: 2,
    })
    await admin
      .getByRole('button', { name: `Reject held vote ${rejectedBand4!.id}` })
      .click()
    await expect(
      admin.getByText('Nothing waiting for a decision.')
    ).toBeVisible({ timeout: 30000 })

    state = await nightState(admin)
    expect(state.crowd.total).toEqual({ approved: 10, pending: 0, rejected: 3 })
    expect(
      BANDS.map((_, i) => state.crowd.byBand[bandId(i + 1)]?.approved ?? 0)
    ).toEqual(COUNTED_VOTES)
  })

  test('judge sheets are entered, validated and can be corrected', async () => {
    const sheetFor = (name: string, scores: number[][]) =>
      scores.map((row, i) => ({
        event_id: EVENT_ID,
        band_id: bandId(i + 1),
        voter_type: 'judge',
        name,
        song_choice: row[0],
        performance: row[1],
        crowd_vibe: row[2],
        visuals: row[3],
      }))

    // Judge One through the real form.
    const judgePage = await adminContext.newPage()
    await judgePage.goto(`/vote/judge/${EVENT_ID}`)
    await expect(
      judgePage.getByRole('heading', { name: 'Judge Scoring' })
    ).toBeVisible({ timeout: 30000 })
    await judgePage.locator('#name').fill('Judge One')
    const criteria = ['Song Choice', 'Performance', 'Crowd Vibe', 'Visuals']
    for (const [bandIndex, band] of BANDS.entries()) {
      for (const [criterionIndex, criterion] of criteria.entries()) {
        await judgePage
          .getByLabel(`${criterion} for ${band}`)
          .fill(String(JUDGE_SHEETS['Judge One'][bandIndex][criterionIndex]))
      }
    }
    await judgePage.getByRole('button', { name: 'Submit All Scores' }).click()
    await expect(
      judgePage.getByRole('heading', { name: 'Scores Submitted!' })
    ).toBeVisible({ timeout: 30000 })
    await judgePage.close()

    // The other two straight at the API.
    for (const name of ['Judge Two', 'Judge Three']) {
      const response = await admin.request.post('/api/votes/batch', {
        data: { votes: sheetFor(name, JUDGE_SHEETS[name]) },
      })
      expect(response.status(), name).toBe(200)
    }

    // The same judge twice (any capitalisation) is refused...
    const duplicate = await admin.request.post('/api/votes/batch', {
      data: { votes: sheetFor('judge two', JUDGE_SHEETS['Judge Two']) },
    })
    expect(duplicate.status()).toBe(409)
    // ...as is an out-of-range score, and a sheet missing a band. Neither
    // leaves a partial sheet behind.
    const outOfRange = sheetFor('Judge Four', JUDGE_SHEETS['Judge One'])
    outOfRange[4].visuals = 21
    expect(
      (
        await admin.request.post('/api/votes/batch', {
          data: { votes: outOfRange },
        })
      ).status()
    ).toBe(400)
    expect(
      (
        await admin.request.post('/api/votes/batch', {
          data: {
            votes: sheetFor('Judge Four', JUDGE_SHEETS['Judge One']).slice(
              0,
              4
            ),
          },
        })
      ).status()
    ).toBe(400)

    // A long name used to overflow the database column and lose the sheet.
    const longName = 'Front of House Lighting Designer (standing in for Alex)'
    const long = await admin.request.post('/api/votes/batch', {
      data: { votes: sheetFor(longName, JUDGE_SHEETS['Judge One']) },
    })
    expect(long.status()).toBe(200)

    let state = await nightState(admin)
    expect(state.judges.map((j) => [j.name, j.bandsScored])).toEqual([
      ['Judge One', 5],
      ['Judge Two', 5],
      ['Judge Three', 5],
      [longName, 5],
    ])

    // That fourth sheet was a mistake: delete it from the run page.
    await expect(
      admin.getByRole('heading', { name: /Judge sheets\s*\(4\)/ })
    ).toBeVisible({ timeout: 30000 })
    await admin
      .getByRole('listitem')
      .filter({ hasText: longName })
      .getByRole('button', { name: 'Delete sheet' })
      .click()
    await admin
      .getByRole('dialog')
      .getByRole('button', { name: 'Yes, delete sheet' })
      .click()
    await expect(
      admin.getByRole('heading', { name: /Judge sheets\s*\(3\)/ })
    ).toBeVisible({ timeout: 30000 })

    state = await nightState(admin)
    expect(state.judges.map((j) => j.name)).toEqual([
      'Judge One',
      'Judge Two',
      'Judge Three',
    ])
  })

  test('provisional standings match the scores worked out by hand', async () => {
    const totals = expectedTotals()
    const state = await nightState(admin)
    expect(state.standingsFrozen).toBe(false)
    for (const [index, band] of BANDS.entries()) {
      const row = state.standings.find((s) => s.band_name === band)
      expect(row, band).toBeTruthy()
      expect(row!.totalScore, band).toBeCloseTo(totals[index], 6)
    }
    expect(state.standings.map((s) => s.band_name)).toEqual([
      'The Dry Runs',
      'Merge Conflict',
      'Soundcheck Sally',
      'Null Pointer Sisters',
      'Rollback Kings',
    ])

    // Scores are hidden on screen until the operator asks for them.
    await expect(
      admin.getByRole('table', { name: 'Provisional standings' })
    ).toBeHidden()
    await admin.getByRole('checkbox', { name: /Show scores/ }).check()
    const table = admin.getByRole('table', { name: 'Provisional standings' })
    await expect(table).toBeVisible()
    await expect(
      table.getByRole('row').filter({ hasText: 'The Dry Runs' })
    ).toContainText('86.00')
    await expect(
      table.getByRole('row').filter({ hasText: 'Merge Conflict' })
    ).toContainText('79.67')
    await admin.getByRole('checkbox', { name: /Show scores/ }).uncheck()
  })

  test('finalising freezes the results but keeps them private', async () => {
    await expect(
      admin.getByRole('button', { name: 'Finalise results', exact: true })
    ).toBeEnabled({ timeout: 30000 })
    await takeStep(admin, 'Finalise results', 'Results locked')

    // The winner is not on screen until asked for.
    await expect(admin.getByText('The winner is hidden.')).toBeVisible()
    await expect(admin.getByRole('list', { name: 'Read-out' })).toHaveCount(0)
    await admin.getByRole('checkbox', { name: /Show scores/ }).check()
    await expect(admin.getByText('86.00 points')).toBeVisible()
    await expect(
      admin.getByRole('table', { name: 'Final results' })
    ).toBeVisible()

    // The read-out for the MC: third place up to the winner, with the other
    // awards each band took (worked out by hand from the sheets above).
    const readOut = admin.getByRole('list', { name: 'Read-out' })
    await expect(readOut.getByRole('listitem')).toHaveText([
      /Third place.*In third place, with 78 points: Soundcheck Sally\./,
      /Second place.*In second place, with 79\.67 points: Merge Conflict\..*Merge Conflict also won the judges' vote, best Song Choice, best Performance and best Crowd Vibe\./,
      /Winner.*And the winner of Test Night \(rehearsal\), with 86 points: The Dry Runs!.*The Dry Runs also won the popular vote and best Visuals\./,
    ])
    await admin.getByRole('checkbox', { name: /Show scores/ }).uncheck()

    const state = await nightState(admin)
    expect(state.standingsFrozen).toBe(true)
    expect(state.standings[0]).toMatchObject({
      band_name: 'The Dry Runs',
      rank: 1,
    })
    expect(state.standings[0].totalScore).toBeCloseTo(86, 2)

    // The public sees nothing: no results page, no scores, no votes accepted.
    await voter.goto(`/results/${EVENT_ID}`)
    await expect(voter).not.toHaveURL(/\/results\//)
    const scores = await voter.request.get(`/api/events/${EVENT_ID}/scores`)
    expect(scores.status()).toBe(403)
    await voter.goto(`/vote/crowd/${EVENT_ID}`)
    await expect(
      voter.getByRole('heading', { name: 'Voting Has Closed' })
    ).toBeVisible({ timeout: 30000 })

    // An admin can preview exactly what will be released.
    const preview = await adminContext.newPage()
    await preview.goto(`/results/${EVENT_ID}`)
    await expect(preview.getByText('The Dry Runs').first()).toBeVisible({
      timeout: 30000,
    })
    await preview.close()
  })

  test('locked results cannot be changed, and stale buttons are refused', async () => {
    const state = await nightState(admin)
    const anyVote = state.reviewed[0]

    const review = await admin.request.patch(`${NIGHT_API}/votes`, {
      data: { status: 'rejected', voteIds: [anyVote.id] },
    })
    expect(review.status()).toBe(409)

    const deleteJudge = await admin.request.delete(`${NIGHT_API}/judges`, {
      data: { name: 'Judge One' },
    })
    expect(deleteJudge.status()).toBe(409)

    const lateSheet = await admin.request.post('/api/votes/batch', {
      data: {
        votes: BANDS.map((_, i) => ({
          event_id: EVENT_ID,
          band_id: bandId(i + 1),
          voter_type: 'judge',
          name: 'Late Judge',
          song_choice: 20,
          performance: 20,
          crowd_vibe: 20,
          visuals: 20,
        })),
      },
    })
    expect(lateSheet.status()).toBe(403)

    // A button pressed on a screen that had not caught up.
    const stale = await admin.request.post(`${NIGHT_API}/transition`, {
      data: { transition: 'close-voting' },
    })
    expect(stale.status()).toBe(409)
    expect((await stale.json()).code).toBe('stale')

    const after = await nightState(admin)
    expect(after.event.status).toBe('locked')
    expect(after.crowd.total).toEqual(state.crowd.total)
    expect(after.judges).toHaveLength(3)
  })

  test('unlocking discards the frozen results and finalising again restores them', async () => {
    await takeStep(admin, 'Unlock results', 'Voting closed')
    let state = await nightState(admin)
    expect(state.standingsFrozen).toBe(false)

    await takeStep(admin, 'Finalise results', 'Results locked')
    state = await nightState(admin)
    expect(state.standingsFrozen).toBe(true)
    expect(state.standings[0].band_name).toBe('The Dry Runs')
  })

  test('releasing makes the results public, and they can be taken down again', async () => {
    await takeStep(admin, 'Release results', 'Results released')

    await voter.goto(`/results/${EVENT_ID}`)
    await expect(voter).toHaveURL(new RegExp(`/results/${EVENT_ID}$`))
    await expect(voter).toHaveTitle(/The Dry Runs Wins/, { timeout: 30000 })
    await expect(voter.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/
    )

    const scores = await voter.request.get(`/api/events/${EVENT_ID}/scores`)
    expect(scores.status()).toBe(200)
    const released = (await scores.json()) as { name: string }[]
    expect(released.map((band) => band.name)).toEqual([
      'The Dry Runs',
      'Merge Conflict',
      'Soundcheck Sally',
      'Null Pointer Sisters',
      'Rollback Kings',
    ])

    // The voting page now points at the results.
    await voter.goto(`/vote/crowd/${EVENT_ID}`)
    await expect(
      voter.getByRole('link', { name: 'See the Results' })
    ).toBeVisible({ timeout: 30000 })

    // Even released, a test event stays out of the public listings.
    for (const path of ['/api/events/past', '/sitemap.xml']) {
      const response = await voter.request.get(path)
      expect(await response.text(), path).not.toContain(EVENT_ID)
    }
    await voter.goto('/events')
    await expect(voter.locator('body')).not.toContainText('Test Night')

    // Released too early? Take them down; the public loses access again.
    await takeStep(admin, 'Take results down', 'Results locked')
    await voter.goto(`/results/${EVENT_ID}`)
    await expect(voter).not.toHaveURL(/\/results\//)
    expect(
      (await voter.request.get(`/api/events/${EVENT_ID}/scores`)).status()
    ).toBe(403)

    // And release again, unchanged.
    await takeStep(admin, 'Release results', 'Results released')
    const again = await voter.request.get(`/api/events/${EVENT_ID}/scores`)
    expect(((await again.json()) as { name: string }[])[0].name).toBe(
      'The Dry Runs'
    )
  })

  test('the history shows every step that was taken', async () => {
    const history = admin.getByRole('list', { name: 'History' })
    for (const step of [
      'Open crowd voting',
      'Close crowd voting',
      'Finalise results',
      'Unlock results',
      'Release results',
      'Take results down',
    ]) {
      await expect(history).toContainText(step)
    }
    await expect(history).toContainText('admin@test.com')
  })

  test('resetting returns the rehearsal to a clean start', async () => {
    await admin.getByRole('button', { name: 'Reset test event' }).click()
    await admin
      .getByRole('dialog')
      .getByRole('button', { name: 'Yes, reset test event' })
      .click()
    await expect(phaseHeading(admin, 'Before voting')).toBeVisible({
      timeout: 30000,
    })

    const state = await nightState(admin)
    expect(state.event.status).toBe('upcoming')
    expect(state.crowd.total).toEqual({ approved: 0, pending: 0, rejected: 0 })
    expect(state.judges).toEqual([])
    expect(state.standingsFrozen).toBe(false)

    // Public results are gone with it.
    expect(
      (await voter.request.get(`/api/events/${EVENT_ID}/scores`)).status()
    ).toBe(403)
  })

  test('a whole night can be rehearsed with simulated votes and judges', async () => {
    // Simulated votes obey the same rule as real ones: voting must be open.
    await expect(
      admin.getByRole('button', { name: 'Add 40 simulated crowd votes' })
    ).toBeDisabled()

    await takeStep(admin, 'Open crowd voting', 'Voting open')
    await admin
      .getByRole('button', { name: 'Add 40 simulated crowd votes' })
      .click()
    await expect(admin.getByLabel('Votes cast')).toHaveText('40', {
      timeout: 30000,
    })
    await admin.getByRole('button', { name: 'Add 3 simulated judges' }).click()
    await expect(
      admin.getByRole('heading', { name: /Judge sheets\s*\(3\)/ })
    ).toBeVisible({ timeout: 30000 })

    await takeStep(admin, 'Close crowd voting', 'Voting closed')

    // Clear whatever was held, whichever way the suggestions fell.
    let state = await nightState(admin)
    if (state.crowd.total.pending > 0) {
      await admin.getByRole('button', { name: /^Follow suggestions/ }).click()
      await expect(
        admin.getByText('Nothing waiting for a decision.')
      ).toBeVisible({ timeout: 30000 })
    }
    state = await nightState(admin)
    expect(state.crowd.total.pending).toBe(0)
    expect(state.crowd.total.approved + state.crowd.total.rejected).toBe(40)

    // Random scores can tie at the top; that is a warning to accept, which
    // the confirmation dialog lists and sends back.
    await expect(
      admin.getByRole('button', { name: 'Finalise results', exact: true })
    ).toBeEnabled({ timeout: 30000 })
    await takeStep(admin, 'Finalise results', 'Results locked')
    await takeStep(admin, 'Release results', 'Results released')

    state = await nightState(admin)
    expect(state.event.status).toBe('finalized')
    expect(state.standings).toHaveLength(5)
    expect(
      state.standings.reduce((sum, row) => sum + row.totalScore, 0)
    ).toBeGreaterThan(0)
  })
})
