/**
 * The ballot: what the crowd voting page needs to draw itself — whether voting
 * is open, and the bands to choose from.
 *
 * Every phone with the voting page open polls this, so it is held in memory
 * for a couple of seconds (and by the CDN, see the route). A few hundred
 * phones cost one query every couple of seconds, and opening or closing voting
 * reaches everyone within about five.
 */

import { competingBands } from './competing-bands'
import { getBandsForEvent, getEventById } from './db'
import { isCrowdVotingOpen, isEventStatus } from './event-lifecycle'

export interface BallotBand {
  id: string
  name: string
  order: number
  company_name?: string
  hero_thumbnail_url?: string
  info?: { logo_url?: string }
}

export interface Ballot {
  event: { id: string; name: string; status: string; votingOpen: boolean }
  bands: BallotBand[]
}

const TTL_MS = 2000
const MAX_CACHED_EVENTS = 100
const cache = new Map<string, { expires: number; ballot: Ballot | null }>()

/** For tests. */
export function clearBallotCache() {
  cache.clear()
}

/** The ballot for an event, or `null` if the event does not exist. */
export async function getBallot(eventId: string): Promise<Ballot | null> {
  const hit = cache.get(eventId)
  if (hit && hit.expires > Date.now()) return hit.ballot

  const event = await getEventById(eventId)
  let ballot: Ballot | null = null
  if (event) {
    // Special guests (non-competing bands) are not on the ballot.
    const bands = competingBands(await getBandsForEvent(eventId))
    ballot = {
      event: {
        id: event.id,
        name: event.name,
        status: event.status,
        votingOpen:
          isEventStatus(event.status) && isCrowdVotingOpen(event.status),
      },
      bands: bands.map((band) => ({
        id: band.id,
        name: band.name,
        order: band.order,
        company_name: band.company_name,
        hero_thumbnail_url: band.hero_thumbnail_url,
        info: band.info?.logo_url
          ? { logo_url: band.info.logo_url }
          : undefined,
      })),
    }
  }
  // The route is public, so any made-up event id lands here. Keep the cache
  // from growing without bound: drop what has expired, or everything.
  if (cache.size >= MAX_CACHED_EVENTS) {
    const now = Date.now()
    for (const [id, entry] of cache) {
      if (entry.expires <= now) cache.delete(id)
    }
    if (cache.size >= MAX_CACHED_EVENTS) cache.clear()
  }
  cache.set(eventId, { expires: Date.now() + TTL_MS, ballot })
  return ballot
}
