/**
 * The results read-out: what the MC says on stage, built from the final
 * standings. Third place, then second, then the winner, and with each band
 * the other awards it took — the judges' vote, the popular vote, and the best
 * score in each judging category. An award won by a band outside the top
 * three is announced first, so nobody's win goes unmentioned.
 *
 * Pure: no database or server-only imports.
 */

import type { NightStanding } from './night-types'
import { getCategories, parseScoringVersion } from './scoring'

/** Something a band can win besides its overall placing. */
export interface Award {
  id: string
  /** How it is said aloud, to follow "won" or "goes to": "the judges' vote". */
  phrase: string
  /** Band ids of the winner, or of every band level at the top. */
  winners: string[]
}

export interface ReadOutSection {
  /** "Third place", "Winner", "Other awards". */
  heading: string
  /** The sentences to read, in order. */
  lines: string[]
}

export interface ReadOut {
  /** Things to sort out before going on stage, such as a tie. Not read aloud. */
  notes: string[]
  sections: ReadOutSection[]
  /** The whole thing as plain text, for copying. */
  text: string
}

/** Only the podium's placings are ever said aloud. */
const PLACES = ['first', 'second', 'third']

/** "86", "79.67", "74.5" — two decimals at most, no trailing zeros. */
export function formatPoints(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '')
}

/** Level to the two decimal places that scores are stored and shown at. */
function isLevel(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100)
}

/** "A", "A and B", "A, B and C". */
function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * The bands with the highest value. Nobody, if nobody scored above zero or if
 * every band is level: an award that no one earned, or that everyone shares,
 * is not an award and is not announced.
 */
function topBands(
  standings: NightStanding[],
  value: (s: NightStanding) => number
): string[] {
  const best = Math.max(0, ...standings.map(value))
  if (best <= 0) return []
  const winners = standings
    .filter((s) => isLevel(value(s), best))
    .map((s) => s.band_id)
  return standings.length > 1 && winners.length === standings.length
    ? []
    : winners
}

/**
 * The awards on offer for a scoring version, with their winners. Awards with
 * no winner (nobody scored) are left out.
 */
export function getAwards(
  standings: NightStanding[],
  scoringVersion: string
): Award[] {
  const version = parseScoringVersion({ scoring_version: scoringVersion })
  const categories = getCategories(version)
  const awards: Award[] = []

  awards.push({
    id: 'judges_vote',
    phrase: "the judges' vote",
    winners: topBands(standings, (s) => s.judgeScore),
  })
  awards.push({
    id: 'popular_vote',
    phrase: 'the popular vote',
    winners: topBands(standings, (s) => s.crowdVoteCount),
  })

  const categoryValue: Record<string, (s: NightStanding) => number> = {
    song_choice: (s) => s.songChoice,
    performance: (s) => s.performance,
    crowd_vibe: (s) => s.crowdVibe,
    visuals: (s) => s.visuals,
    scream_o_meter: (s) => s.screamOMeter,
  }
  for (const category of categories) {
    const value = categoryValue[category.id]
    if (!value) continue // the crowd vote is "the popular vote" above
    awards.push({
      id: category.id,
      phrase:
        category.type === 'measurement'
          ? `the ${category.label}`
          : `best ${category.label}`,
      winners: topBands(standings, value),
    })
  }

  return awards.filter((award) => award.winners.length > 0)
}

/**
 * Build the read-out from final standings (rank order, winner first).
 * Returns no sections when there are no standings.
 */
export function buildReadOut(
  standings: NightStanding[],
  scoringVersion: string,
  eventName: string
): ReadOut {
  const ranked = [...standings].sort((a, b) => a.rank - b.rank)
  if (ranked.length === 0) return { notes: [], sections: [], text: '' }

  const awards = getAwards(ranked, scoringVersion)
  const name = (id: string) =>
    ranked.find((s) => s.band_id === id)?.band_name ?? 'Unknown band'
  const podium = ranked.slice(0, 3)
  const onPodium = new Set(podium.map((s) => s.band_id))

  /** "the popular vote" or, when shared, "the popular vote, shared with X". */
  const awardFor = (award: Award, bandId: string): string => {
    const others = award.winners.filter((id) => id !== bandId).map(name)
    return others.length === 0
      ? award.phrase
      : `${award.phrase} (shared with ${joinList(others)})`
  }
  const alsoWon = (band: NightStanding): string | null => {
    const won = awards
      .filter((award) => award.winners.includes(band.band_id))
      .map((award) => awardFor(award, band.band_id))
    return won.length === 0
      ? null
      : `${band.band_name} also won ${joinList(won)}.`
  }

  // A tie that touches the podium — including the band just below it being
  // level with third — has to be settled before anything is read out.
  const notes: string[] = []
  for (const band of ranked.slice(0, podium.length + 1)) {
    if (band.tiedWithPrevious) {
      const above = ranked[ranked.indexOf(band) - 1]
      notes.push(
        `${above.band_name} and ${band.band_name} are level on ${formatPoints(band.totalScore)} points. Decide how to announce that before you go on.`
      )
    }
  }

  // Said by position on the podium, so it reads right whatever the rank
  // numbers are.
  const place = (band: NightStanding) => PLACES[podium.indexOf(band)]

  const sections: ReadOutSection[] = []

  // Awards that went to a band outside the top three come first. Their
  // placing is not mentioned: nobody needs to hear who came last.
  const otherLines: string[] = []
  for (const award of awards) {
    const offPodium = award.winners.filter((id) => !onPodium.has(id))
    if (offPodium.length === 0) continue
    const sharedWithPodium = award.winners.filter((id) => onPodium.has(id))
    const phrase =
      sharedWithPodium.length === 0
        ? award.phrase
        : `${award.phrase} (shared with ${joinList(sharedWithPodium.map(name))})`
    otherLines.push(
      `${capitalise(phrase)} goes to ${joinList(offPodium.map(name))}.`
    )
  }
  if (otherLines.length > 0) {
    sections.push({ heading: 'Other awards', lines: otherLines })
  }

  // Then the podium, from the bottom up.
  for (const band of [...podium].reverse()) {
    const points = `${formatPoints(band.totalScore)} points`
    const lines =
      band.rank === 1
        ? [`And the winner of ${eventName}, with ${points}: ${band.band_name}!`]
        : [`In ${place(band)} place, with ${points}: ${band.band_name}.`]
    const extra = alsoWon(band)
    if (extra) lines.push(extra)
    sections.push({
      heading: band.rank === 1 ? 'Winner' : `${capitalise(place(band))} place`,
      lines,
    })
  }

  const text = [
    ...notes.map((note) => `NOTE: ${note}`),
    ...sections.map(
      (section) =>
        `${section.heading.toUpperCase()}\n${section.lines.join('\n')}`
    ),
  ].join('\n\n')

  return { notes, sections, text }
}
