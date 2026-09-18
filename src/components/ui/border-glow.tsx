'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface BorderGlowProps {
  /**
   * Corner radius in px. Match the parent card's rounded-* class, or the glow
   * will cut the corners (rounded-xl = 12, rounded-2xl = 16).
   */
  radius?: number
  /** How long the single lap takes, in ms. */
  duration?: number
  /** Fraction of the perimeter the light covers, 0-1. */
  arc?: number
  /** Thickness in px. Defaults to 4 to match the card's h-1 top bar. */
  thickness?: number
  /** Blur radius in px. Just enough to soften the ends, not to bloom. */
  blur?: number
  /** How far into view the card must be before the lap starts, 0-1. */
  threshold?: number
  className?: string
}

/**
 * A single clockwise lap of light around the parent's border, run once when
 * the card scrolls into view.
 *
 * This is the card's existing top-edge glow taken around the other three
 * edges — same 4px thickness, same accent at 50% — not a brighter or wider
 * effect of its own. Widening the stroke or raising the blur turns it into a
 * halo, which is what it is deliberately not.
 *
 * The parent needs `relative`; `overflow-hidden` keeps the outer half of the
 * stroke off the corners. `pathLength={100}` renormalises the dash units to
 * hundredths of the perimeter, so one set of values works at every card size
 * without measuring the element.
 *
 * It fires once and then stops: `forwards` holds the final frame, and the
 * observer disconnects on the first intersection, so scrolling back up does
 * not replay it. Under `prefers-reduced-motion` the animation is dropped and
 * nothing moves.
 */
export function BorderGlow({
  radius = 16,
  duration = 1800,
  arc = 0.3,
  thickness = 4,
  blur = 2,
  threshold = 0.35,
  className,
}: BorderGlowProps) {
  const ref = useRef<SVGSVGElement>(null)
  const [hasRun, setHasRun] = useState(false)

  useEffect(() => {
    const el = ref.current
    // No observer in jsdom and older browsers: leave the border unlit rather
    // than animating immediately, since the point is the scroll arrival.
    if (!el || hasRun || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHasRun(true)
          observer.disconnect()
        }
      },
      { threshold }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasRun, threshold])

  const lit = Math.round(arc * 100)
  const filterId = `border-glow-${useId().replace(/:/g, '')}`
  const travelling = cn('opacity-0', hasRun && 'animate-border-glow')
  const travel = hasRun ? { animationDuration: `${duration}ms` } : undefined

  // Shared geometry. pathLength renormalises the dash to hundredths of the
  // perimeter, so both passes stay in step at any card size.
  const arcProps = {
    x: 0,
    y: 0,
    width: '100%',
    height: '100%',
    rx: radius,
    ry: radius,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    pathLength: 100,
    strokeDasharray: `${lit} ${100 - lit}`,
    strokeDashoffset: 0,
  }

  return (
    <svg
      ref={ref}
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="none"
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full text-accent',
        className
      )}
    >
      <defs>
        <filter
          id={filterId}
          x="-25%"
          y="-25%"
          width="150%"
          height="150%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation={blur} />
        </filter>
      </defs>

      {/* One pass, matching the top bar: 4px at accent/50, with just enough
          blur to fade the ends the way the bar's gradient does. */}
      <rect
        {...arcProps}
        strokeWidth={thickness}
        opacity={0.5}
        filter={`url(#${filterId})`}
        className={travelling}
        style={travel}
      />
    </svg>
  )
}
