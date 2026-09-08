import type { VideoType } from './db-types'

/**
 * 15 minutes. The real full sets start at 21:36 and the longest single song is
 * 6:19, so the floor sits in the middle of a very wide empty gap.
 */
export const FULL_SET_MIN_DURATION_SECONDS = 900

/**
 * Decide whether a non-Short video is a single song or a band's full set.
 *
 * Two independent signals, either of which is sufficient:
 *
 * - the title says so — every full set we publish is titled "(Full Set)"
 * - the duration is 15 minutes or more — the gap in the real data is wide
 *   (single songs top out at 6:19, full sets start at 21:36), so a 15-minute
 *   floor cannot misfile a single song even if the title convention lapses
 *
 * Duration is often unknown at import time (the YouTube metadata fetch is
 * best-effort), which is why the title check has to stand on its own.
 */
export function classifyLongForm(
  title: string,
  durationSeconds: number | null
): VideoType {
  if (/full\s*set/i.test(title)) return 'full_set'
  if (
    durationSeconds !== null &&
    durationSeconds >= FULL_SET_MIN_DURATION_SECONDS
  ) {
    return 'full_set'
  }
  return 'video'
}
