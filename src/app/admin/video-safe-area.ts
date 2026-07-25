/**
 * Safe-area margins and a minimum type scale shared by the canvas generators
 * that produce artwork for YouTube — the song thumbnail/overlay
 * (`thumbnails/compose.ts`) and the full-set title/credits pages
 * (`band-set/compose.ts`).
 *
 * Two separate problems drive these numbers:
 *
 * 1. **Edges get eaten.** SMPTE title-safe is the inner 90% for HD (5% inset)
 *    and the inner 80% traditionally (10% inset); modern social-video guidance
 *    converges on ~8% horizontal / ~10% vertical, because phones crop 16:9 in
 *    feeds and the player draws its own chrome over the frame. We sit between
 *    the two: comfortably inside HD title-safe, without pulling the layout so
 *    far in that the composition goes weedy.
 *
 * 2. **The YouTube player covers the bottom.** The scrubber spans roughly the
 *    bottom 5% of the frame and the full control bar about the bottom 10%, so
 *    anything burned into the video within that strip is hidden whenever the
 *    controls are up (always, on mobile tap). The bottom margin is therefore
 *    deliberately larger than the top one. On a thumbnail the same strip is
 *    where the duration badge and channel chips land, so the extra room helps
 *    there too.
 *
 * All values are fractions of the relevant axis, so a layout built from them
 * renders identically at 1080p, 4K, or any preview size. Horizontal margins are
 * a fraction of *width* — deriving them from height (as a single `pad` does)
 * makes the side margins only ~56% of the top margin on a 16:9 frame, which is
 * what left the old logos hanging off the edge.
 */

/** Fraction of the frame width kept clear at the left and right edges. */
export const SAFE_X = 0.06

/** Fraction of the frame height kept clear at the top edge. */
export const SAFE_TOP = 0.07

/**
 * Fraction of the frame height kept clear at the bottom edge — sized to clear
 * the YouTube control bar (~10%) rather than just the scrubber (~5%).
 */
export const SAFE_BOTTOM = 0.115

/**
 * Minimum on-screen type sizes as a fraction of frame height, so text stays
 * legible both in a feed thumbnail (rendered as small as ~170px wide) and on a
 * phone playing the video (a 16:9 frame is only ~220pt tall on a typical
 * handset). Roles here are by prominence, not by which generator uses them.
 */
export const MIN_TYPE = {
  /** Band / artist name — the one thing that must read at thumbnail size. */
  hero: 0.06,
  /** Song title, event name. */
  primary: 0.038,
  /** Date, venue, member names. */
  secondary: 0.032,
  /** All-caps supporting labels ("POWERED BY", "FEATURING", instrument roles). */
  label: 0.024,
} as const

/** Pixel margins for a `w`×`h` frame. */
export function safeInsets(w: number, h: number) {
  return {
    x: Math.round(w * SAFE_X),
    top: Math.round(h * SAFE_TOP),
    bottom: Math.round(h * SAFE_BOTTOM),
  }
}
