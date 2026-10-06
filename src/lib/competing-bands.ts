/**
 * Non-competing bands: special guests who play on the night but are not
 * judged, cannot be voted for and are never ranked (ShipReX at Sydney 2026).
 *
 * The flag lives in the band's `info` jsonb as `non_competing: true`; there is
 * no column for it. A band without the flag competes.
 *
 * Pure, so it is safe in client components. The SQL twin of this check, used
 * where bands are filtered in a query (`getBandScores`), is
 * `b.info->'non_competing' IS DISTINCT FROM 'true'::jsonb` (JSON `true` only,
 * like this check; a missing `info` competes).
 *
 * See doc/requirements/run-the-night.md ("Non-competing bands").
 */

/** Anything with a band's `info`; extra fields are ignored. */
export interface BandWithInfo {
  info?: { non_competing?: unknown; [key: string]: unknown } | null
}

/** True unless the band is flagged `info.non_competing = true`. */
export function isCompetingBand(band: BandWithInfo): boolean {
  return band.info?.non_competing !== true
}

/** The bands that are judged, voted for and ranked, in their given order. */
export function competingBands<T extends BandWithInfo>(bands: T[]): T[] {
  return bands.filter(isCompetingBand)
}

/** How a non-competing band is labelled wherever the event's bands are listed. */
export const NON_COMPETING_LABEL = 'Special guests'
