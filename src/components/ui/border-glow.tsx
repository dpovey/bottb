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
  /** Fraction of the perimeter the light covers, 0-1. Wider reads softer. */
  arc?: number
  /** Blur radius in px. This is what makes it glow rather than draw. */
  blur?: number
  /** How far into view the card must be before the lap starts, 0-1. */
  threshold?: number
  className?: string
}

/**
 * A single clockwise lap of light around the parent's border, run once when
 * the card scrolls into view.
 *
 * It is the card's top-edge glow smeared around the border rather than a line
 * traced along it: two heavily blurred arcs, wide and dim, travel together.
 * Sharpening the stroke or dropping the blur turns it back into a drawn
 * outline, which is the thing this is not meant to look like.
 *
 * The parent needs `relative`; `overflow-hidden` keeps the outer half of the
 * blur off the corners. `pathLength={100}` renormalises the dash units to
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
  blur = 6,
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

      {/* The glow itself: a wide, heavily blurred arc. This is the top bar's
          soft shading smeared along the border, not a drawn line — the blur
          is what stops it reading as a stroke. */}
      <rect
        {...arcProps}
        strokeWidth={blur * 2.5}
        opacity={0.55}
        filter={`url(#${filterId})`}
        className={travelling}
        style={travel}
      />

      {/* A dim core, blurred too, so the brightest point tracks the middle of
          the smear rather than leaving it uniformly foggy. */}
      <rect
        {...arcProps}
        strokeWidth={blur}
        opacity={0.35}
        filter={`url(#${filterId})`}
        className={travelling}
        style={travel}
      />
    </svg>
  )
}
