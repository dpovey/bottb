/**
 * Crew credits for the videographers feature.
 *
 * Not everyone credited on an event's video was behind a camera — Brisbane
 * 2026 also had an engineer recording the multitrack audio the final videos
 * and mixes are built from. `role` on the videographer record labels the
 * credit; these helpers keep the wording consistent across the public pages
 * and the admin screen.
 */

export const DEFAULT_VIDEOGRAPHER_ROLE = 'Videographer'

/** Roles offered in the admin dropdown. Any free-text role still renders. */
export const VIDEOGRAPHER_ROLES = [
  DEFAULT_VIDEOGRAPHER_ROLE,
  'Audio Engineer',
] as const

/**
 * The verb that fits a role, for event counts: "3 events filmed" reads wrong
 * for someone who ran the recording rig.
 */
export function creditVerb(role: string | null | undefined): string {
  return role === 'Audio Engineer' ? 'recorded' : 'filmed'
}
