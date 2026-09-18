'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface BorderGlowProps {
  /**
   * Corner radius in px. Match the parent card's rounded-* class, or the glow
   * will cut the corners (rounded-xl = 12, rounded-2xl = 16).
   */
  radius?: number
  /** How long the single lap takes, in ms. */
  duration?: number
  /** Fraction of the perimeter the lit arc covers, 0-1. */
  arc?: number
  /** How far into view the card must be before the lap starts, 0-1. */
  threshold?: number
  className?: string
}

/**
 * A single clockwise lap of light around the parent's border, run once when
 * the card scrolls into view.
 *
 * The parent needs `relative`; `overflow-hidden` keeps the stroke's outer half
 * off the corners. The rect carries `pathLength={100}`, which renormalises the
 * dash units to hundredths of the perimeter — so one set of dash values works
 * at every card size without measuring the element.
 *
 * It fires once and then stops: `forwards` holds the final frame, and the
 * observer disconnects on the first intersection, so scrolling back up does
 * not replay it. Under `prefers-reduced-motion` the animation is dropped and
 * nothing moves.
 */
export function BorderGlow({
  radius = 16,
  duration = 1600,
  arc = 0.18,
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
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        rx={radius}
        ry={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${lit} ${100 - lit}`}
        strokeDashoffset={0}
        className={cn('opacity-0', hasRun && 'animate-border-glow')}
        style={hasRun ? { animationDuration: `${duration}ms` } : undefined}
      />
    </svg>
  )
}
