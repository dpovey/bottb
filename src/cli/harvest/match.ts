/**
 * Matching a harvested post to an event and a band.
 *
 * Pure functions over text, a timestamp and the event/band tables. No
 * database access and no clock, so the same post always resolves the same
 * way and the rules can be tested against real captions.
 *
 * The hard part is not finding a city name. It is that a post can name two
 * events: the Brisbane 2026 wrap-up ends "Next stop: Sydney. 8 October at The
 * Manning Bar, with Amazon, Atlassian, Canva and V2 AI already locked in."
 * That post is ABOUT Brisbane and MENTIONS Sydney. A first-match-wins rule
 * files it under Sydney 2026 and quietly corrupts every per-event count.
 *
 * So every event is scored and the winner has to win clearly. Where it does
 * not, the post is left unmatched, which is a cheap and honest outcome - a
 * null event_id is a question, a wrong one is a lie the next reader inherits.
 */

export interface EventRef {
  id: string
  /** ISO date of the event itself. */
  date: string
  /** 'brisbane' | 'sydney' | 'melbourne', derived from the id. */
  city: string
  year: number
}

export interface BandRef {
  id: string
  name: string
  event_id: string
  company_slug: string | null
}

export interface CompanyRef {
  slug: string
  name: string
}

export type MatchConfidence = 'high' | 'medium' | 'low' | 'none'

export interface MatchResult {
  eventId: string | null
  bandId: string | null
  eventConfidence: MatchConfidence
  bandConfidence: MatchConfidence
  /** Human-readable reasons, in the order they contributed. */
  reasons: string[]
  /** Every event that scored, best first. Useful in a dry run. */
  scores: { eventId: string; score: number }[]
}

export function toEventRef(row: { id: string; date: string | Date }): EventRef {
  const [city, year] = row.id.split('-')
  const date =
    row.date instanceof Date ? row.date.toISOString() : String(row.date)
  return { id: row.id, date, city, year: Number(year) }
}

const DAY = 86_400_000

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
}

/** Whole-word-ish containment, so "seek" does not match "seeking". */
function mentions(haystack: string, needle: string): boolean {
  const n = norm(needle).trim()
  if (n.length < 3) return false
  // Punctuation inside a name is not load-bearing and is written
  // inconsistently: the band row says "Loop There It Is", every caption
  // writes "Loop, There it is". Any run of non-alphanumerics in the needle
  // matches any run (or none) in the text.
  const pattern = n
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^a-z0-9]*')
  if (!pattern) return false
  return new RegExp(`(^|[^a-z0-9])${pattern}([^a-z0-9]|$)`, 'i').test(haystack)
}

/**
 * Bands whose name is a common word, or a substring of another band's name,
 * need a tighter test than `mentions`. "Jumbo" appears in every caption that
 * credits the sponsor, so the sponsor line must not look like a band credit.
 */
const AMBIGUOUS_BAND_NAMES = new Set(['jumbo'])

export interface MatchInput {
  /** Caption, message or title+description, concatenated. */
  text: string
  /** ISO publish time. */
  postedAt: string
}

export function matchPost(
  input: MatchInput,
  events: EventRef[],
  bands: BandRef[],
  companies: CompanyRef[]
): MatchResult {
  const text = norm(input.text)
  const t = Date.parse(input.postedAt)
  const scores = new Map<string, number>()
  const reasons: string[] = []
  const add = (eventId: string, n: number, why: string) => {
    scores.set(eventId, (scores.get(eventId) ?? 0) + n)
    reasons.push(`${eventId} +${n}: ${why}`)
  }

  for (const ev of events) {
    // 1. The event slug in a link. As explicit as it gets.
    if (text.includes(ev.id)) add(ev.id, 5, `slug "${ev.id}" in text`)

    // 2. "Brisbane 2026" / "2026 ... Brisbane" within a short span. The span
    //    matters: "Brisbane" and "2026" both appear in almost every 2026
    //    caption, so proximity is the whole signal.
    const near = new RegExp(
      `${ev.city}[^.\\n]{0,30}\\b${ev.year}\\b|\\b${ev.year}\\b[^.\\n]{0,30}${ev.city}`,
      'i'
    )
    if (near.test(text)) add(ev.id, 3, `"${ev.city}" near "${ev.year}"`)

    // 3. The year's own hashtag (#bottb24, #BotTB26) and the bare
    //    "Battle of the Tech Bands <year>".
    //
    //    How much this is worth depends entirely on how many events that
    //    year had. 2022, 2023 and 2024 each had exactly one, so the year
    //    alone identifies the event. 2025 had two and 2026 has three, so the
    //    same signal needs a city beside it to mean anything.
    const soleEventOfYear =
      events.filter((e) => e.year === ev.year).length === 1
    const yearSignal =
      text.includes(`#bottb${String(ev.year).slice(2)}`) ||
      text.includes(`#bottb${ev.year}`) ||
      new RegExp(
        `battle of the tech bands\\b[^.\\n]{0,8}\\b${ev.year}\\b`
      ).test(text)
    // A year named long after the fact is history, not subject matter:
    // "From the very first Battle of the Tech Bands in 2022" opens a post
    // promoting the 2025 show. Discount the signal outside a season either
    // side of the event so a retrospective aside cannot outweigh the event
    // the post is actually about.
    const retrospective =
      Number.isFinite(t) && Math.abs((t - Date.parse(ev.date)) / DAY) > 200
    if (yearSignal && soleEventOfYear) {
      add(
        ev.id,
        retrospective ? 1 : 3,
        `year ${ev.year} names the only event that year${
          retrospective ? ' (retrospective mention)' : ''
        }`
      )
    } else if (yearSignal && mentions(text, ev.city)) {
      add(ev.id, retrospective ? 1 : 2, `year ${ev.year} with "${ev.city}"`)
    }
  }

  // 4. Band names. A band belongs to exactly one event, so a band name is a
  //    strong event signal - but only for bands whose name is distinctive.
  const bandHits: BandRef[] = []
  for (const b of bands) {
    const name = norm(b.name)
    const bare = name.replace(/^the /, '')
    const hit = AMBIGUOUS_BAND_NAMES.has(bare)
      ? mentions(text, `${bare} band`)
      : mentions(text, name) || mentions(text, bare)
    if (hit) {
      bandHits.push(b)
      add(b.event_id, 2, `band "${b.name}"`)
    }
  }

  // 5. Company names, weaker again: a company fields a band at several
  //    events, and Jumbo Interactive is named in every caption as sponsor.
  const companyByName = new Map(companies.map((c) => [norm(c.name), c]))
  for (const [name, c] of companyByName) {
    if (c.slug === 'jumbo-interactive') continue // sponsor line, not a signal
    if (!mentions(text, name)) continue
    const evs = new Set(
      bands.filter((b) => b.company_slug === c.slug).map((b) => b.event_id)
    )
    if (evs.size === 1) {
      const [only] = [...evs]
      add(only, 1, `company "${c.name}" plays only ${only}`)
    }
  }

  // 6. Date proximity, as a tiebreak rather than a claim. Posts cluster from
  //    roughly three months before an event to two months after; a post
  //    outside that window is not about it.
  if (Number.isFinite(t)) {
    for (const ev of events) {
      const delta = (t - Date.parse(ev.date)) / DAY
      if (delta >= -100 && delta <= 75) {
        // Nearer is worth marginally more, but never enough to overturn a
        // textual signal on its own.
        const n = delta >= -30 && delta <= 45 ? 1.5 : 0.5
        add(ev.id, n, `posted ${Math.round(delta)}d from the event`)
      }
    }
  }

  const ranked = [...scores.entries()]
    .map(([eventId, score]) => ({ eventId, score }))
    .sort((a, b) => b.score - a.score || a.eventId.localeCompare(b.eventId))

  const best = ranked[0]
  const runnerUp = ranked[1]
  const margin = best ? best.score - (runnerUp?.score ?? 0) : 0

  let eventId: string | null = null
  let eventConfidence: MatchConfidence = 'none'
  if (best && best.score >= 5 && margin >= 2) {
    eventId = best.eventId
    eventConfidence = 'high'
  } else if (best && best.score >= 3 && margin >= 1) {
    eventId = best.eventId
    eventConfidence = 'medium'
  } else if (best && best.score >= 1 && margin >= 0.5) {
    eventId = best.eventId
    eventConfidence = 'low'
  }

  // A band is only assigned when exactly one band from the winning event was
  // named. Two bands named means the post is about the night, not the band.
  const forEvent = bandHits.filter((b) => b.event_id === eventId)
  let bandId: string | null = null
  let bandConfidence: MatchConfidence = 'none'
  if (eventId && forEvent.length === 1) {
    bandId = forEvent[0].id
    bandConfidence = eventConfidence === 'high' ? 'high' : 'medium'
  } else if (eventId && forEvent.length > 1) {
    reasons.push(
      `band left null: ${forEvent.length} bands named (${forEvent
        .map((b) => b.name)
        .join(', ')})`
    )
  }

  return {
    eventId,
    bandId,
    eventConfidence,
    bandConfidence,
    reasons,
    scores: ranked,
  }
}
