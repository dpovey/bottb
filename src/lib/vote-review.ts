/**
 * Reviewing held crowd votes.
 *
 * A crowd vote is held (`pending`) when it looks like a repeat of an earlier
 * one: the same email address, the same browser fingerprint, or an identical
 * browser on the same IP address. Identical phones are indistinguishable to
 * us — same fingerprint, same browser string, and on venue Wi-Fi or a mobile
 * carrier the same IP address too — so most held votes at an event are
 * different people with the same handset, often colleagues voting for the same
 * band. Nothing that might be a real person's vote is thrown away: it is held,
 * and this module lines it up against the earlier votes it matched so an
 * admin can decide quickly, with a suggestion.
 *
 * Pure: no database or server-only imports.
 */

import type { VoteStatus } from './db-types'

/** The fields of a crowd vote that matter for review. */
export interface ReviewVote {
  id: string
  band_id: string
  status: VoteStatus
  created_at: string
  ip_address: string | null
  user_agent: string | null
  browser_name: string | null
  os_name: string | null
  os_version: string | null
  device_type: string | null
  screen_resolution: string | null
  fingerprintjs_visitor_id: string | null
  email: string | null
  reviewed_at: string | null
  reviewed_by: string | null
}

/**
 * Why a held vote matched an earlier one.
 *
 * - `email`       the same email address
 * - `device`      the same browser fingerprint (an identical handset)
 * - `connection`  an identical browser on the same IP address
 */
export type MatchReason = 'email' | 'device' | 'connection'

export interface VoteMatch {
  voteId: string
  bandId: string
  status: VoteStatus
  createdAt: string
  matchedBy: MatchReason[]
  sameIp: boolean
  sameBand: boolean
  /** How long before the held vote this one was cast. */
  secondsEarlier: number
}

export type ReviewSuggestion = 'approve' | 'reject'

export interface ReviewItem {
  vote: ReviewVote
  /** Earlier votes this one matched, most recent first. */
  matches: VoteMatch[]
  suggestion: ReviewSuggestion
  /** One line explaining the suggestion. */
  reason: string
}

/**
 * An IP address with at least this many different kinds of device behind it
 * is a shared network (venue Wi-Fi, a carrier gateway), where two identical
 * phones are to be expected.
 */
export const SHARED_NETWORK_DEVICE_KINDS = 3

/**
 * How many votes from identical phones on one unshared connection are given
 * the benefit of the doubt. Two can easily be two people; a third or later
 * one looks like the same phone voting again.
 */
export const IDENTICAL_PHONES_ALLOWED = 2

function normaliseEmail(email: string | null): string | null {
  const trimmed = email?.trim().toLowerCase()
  return trimmed ? trimmed : null
}

/** Orders votes by time cast, with the id as a stable tie-break. */
function isEarlier(a: ReviewVote, b: ReviewVote): boolean {
  const ta = new Date(a.created_at).getTime()
  const tb = new Date(b.created_at).getTime()
  return ta === tb ? a.id < b.id : ta < tb
}

/**
 * What tells one kind of device from another on the same network: its browser
 * string and screen size. The browser fingerprint is deliberately left out —
 * it can differ between two tabs on one phone, and one phone must not be able
 * to make its own connection look like a room full of people.
 */
function deviceKind(vote: ReviewVote): string {
  return [vote.user_agent ?? '', vote.screen_resolution ?? ''].join('|')
}

/** IP addresses with enough different devices behind them to be shared. */
export function findSharedNetworks(votes: ReviewVote[]): Set<string> {
  const kindsByIp = new Map<string, Set<string>>()
  for (const vote of votes) {
    if (!vote.ip_address) continue
    let kinds = kindsByIp.get(vote.ip_address)
    if (!kinds) kindsByIp.set(vote.ip_address, (kinds = new Set()))
    kinds.add(deviceKind(vote))
  }
  const shared = new Set<string>()
  for (const [ip, kinds] of kindsByIp) {
    if (kinds.size >= SHARED_NETWORK_DEVICE_KINDS) shared.add(ip)
  }
  return shared
}

/**
 * Find the earlier votes a vote matched and suggest what to do with it.
 *
 * - Same email as an earlier vote: the same person. Suggest rejecting.
 * - The third or later vote from identical phones on one IP address that is
 *   not a shared network: the same phone voting again. Suggest rejecting.
 * - Anything else — an identical handset on another network, a second
 *   identical phone on the same connection, identical phones on venue Wi-Fi:
 *   most likely a different person. Suggest approving.
 */
export function reviewVote(
  vote: ReviewVote,
  all: ReviewVote[],
  sharedNetworks: Set<string> = findSharedNetworks(all)
): ReviewItem {
  const email = normaliseEmail(vote.email)
  const device = vote.fingerprintjs_visitor_id || null
  const castAt = new Date(vote.created_at).getTime()

  const matches: VoteMatch[] = []
  for (const other of all) {
    if (other.id === vote.id || !isEarlier(other, vote)) continue
    const sameIp = !!vote.ip_address && other.ip_address === vote.ip_address
    const matchedBy: MatchReason[] = []
    if (email && normaliseEmail(other.email) === email) matchedBy.push('email')
    if (device && other.fingerprintjs_visitor_id === device) {
      matchedBy.push('device')
    }
    if (sameIp && !!vote.user_agent && other.user_agent === vote.user_agent) {
      matchedBy.push('connection')
    }
    if (matchedBy.length === 0) continue
    matches.push({
      voteId: other.id,
      bandId: other.band_id,
      status: other.status,
      createdAt: other.created_at,
      matchedBy,
      sameIp,
      sameBand: other.band_id === vote.band_id,
      secondsEarlier: Math.max(
        0,
        Math.round((castAt - new Date(other.created_at).getTime()) / 1000)
      ),
    })
  }
  matches.sort((a, b) => a.secondsEarlier - b.secondsEarlier)

  const item = (suggestion: ReviewSuggestion, reason: string): ReviewItem => ({
    vote,
    matches,
    suggestion,
    reason,
  })

  if (matches.some((m) => m.matchedBy.includes('email'))) {
    return item('reject', 'Same email address as an earlier vote.')
  }
  if (matches.length === 0) {
    return item('approve', 'The earlier vote it matched is no longer there.')
  }

  // Earlier votes from what looks like the same phone on the same IP address.
  const onSameConnection = matches.filter((m) => m.sameIp).length
  if (onSameConnection === 0) {
    return item(
      'approve',
      matches.length === 1
        ? 'Same model of phone as 1 earlier vote, on a different network. Usually a different person.'
        : `Same model of phone as ${matches.length} earlier votes, on different networks. Usually different people.`
    )
  }
  if (vote.ip_address && sharedNetworks.has(vote.ip_address)) {
    return item(
      'approve',
      'Identical phone on a busy shared network (venue Wi-Fi or a mobile carrier). Usually a different person.'
    )
  }
  if (onSameConnection < IDENTICAL_PHONES_ALLOWED) {
    return item(
      'approve',
      'A second identical phone on the same connection. Could well be two people.'
    )
  }
  return item(
    'reject',
    `Vote number ${onSameConnection + 1} from identical phones on one connection. Looks like the same phone voting again.`
  )
}

/** Review items for every held vote, oldest first. */
export function buildReviewQueue(votes: ReviewVote[]): ReviewItem[] {
  const sharedNetworks = findSharedNetworks(votes)
  return votes
    .filter((v) => v.status === 'pending')
    .sort((a, b) => (isEarlier(a, b) ? -1 : 1))
    .map((v) => reviewVote(v, votes, sharedNetworks))
}

/** "iOS 18.6 · Safari · 390x844" — enough to recognise a handset model. */
export function describeDevice(vote: ReviewVote): string {
  const os = [vote.os_name, vote.os_version]
    .filter((part) => part && part !== 'Unknown')
    .join(' ')
  const parts = [
    os,
    vote.browser_name && vote.browser_name !== 'Unknown'
      ? vote.browser_name
      : null,
    vote.screen_resolution,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'Unknown device'
}

export interface CrowdVoteCounts {
  approved: number
  pending: number
  rejected: number
}

/** Crowd vote counts by status, overall and per band. */
export function countCrowdVotes(votes: ReviewVote[]): {
  total: CrowdVoteCounts
  byBand: Record<string, CrowdVoteCounts>
} {
  const total: CrowdVoteCounts = { approved: 0, pending: 0, rejected: 0 }
  const byBand: Record<string, CrowdVoteCounts> = {}
  for (const vote of votes) {
    const band = (byBand[vote.band_id] ??= {
      approved: 0,
      pending: 0,
      rejected: 0,
    })
    total[vote.status]++
    band[vote.status]++
  }
  return { total, byBand }
}
