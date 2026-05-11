import type { CSSProperties } from 'react'

/**
 * Compute the start/end transform values for a hero Ken Burns animation
 * from a focal point. The pan starts off-focal and settles on the focal
 * point, so the camera "discovers" the subject rather than just zooming.
 *
 * Returns CSS custom properties consumed by the `ken-burns` and
 * `ken-burns-pan` keyframes in `globals.css`.
 */
export function kenBurnsVarsFromFocal(
  focal: { x: number; y: number },
  orientation: 'portrait' | 'landscape'
): CSSProperties {
  // Portrait box + landscape photo = wide horizontal crop room → bigger
  // horizontal swing, gentler zoom. Landscape box = the opposite.
  //
  // Scale floor matters: for a translate of A% to stay inside the box
  // we need scale s where (s-1)/(2s) >= A/100. Below that the image
  // doesn't cover the box on the extreme and a black edge leaks in.
  const config =
    orientation === 'portrait'
      ? { ampX: 8, ampY: 0, scaleFrom: 1.2, scaleTo: 1.24 }
      : { ampX: 4, ampY: 2, scaleFrom: 1.1, scaleTo: 1.16 }

  const x = focalPanRange(focal.x, config.ampX)
  const y = focalPanRange(focal.y, config.ampY)

  return {
    ['--kb-x-from' as string]: `${x.start.toFixed(1)}%`,
    ['--kb-x-to' as string]: `${x.end.toFixed(1)}%`,
    ['--kb-y-from' as string]: `${y.start.toFixed(1)}%`,
    ['--kb-y-to' as string]: `${y.end.toFixed(1)}%`,
    ['--kb-scale-from' as string]: String(config.scaleFrom),
    ['--kb-scale-to' as string]: String(config.scaleTo),
  }
}

/**
 * For a focal coord (0–100) and an amplitude (in %), return the start/end
 * translate offsets. The pan always uses the full amplitude — focal only
 * sets the *direction* (camera starts on the opposite side from the
 * subject and settles on it). Centered focals default to a left-to-centre
 * sweep so motion never flatlines.
 */
function focalPanRange(focalPct: number, amplitude: number) {
  if (amplitude === 0) return { start: 0, end: 0 }
  const bias = (focalPct - 50) / 50 // -1 (far left) … +1 (far right)
  const direction = bias < 0 ? -1 : 1
  return {
    start: -direction * amplitude,
    end: 0,
  }
}
