'use client'

import { forwardRef } from 'react'

interface ShuffleButtonProps {
  /** Whether shuffle is currently active */
  isActive: boolean
  /** Called when the button is clicked */
  onClick: () => void
  /** Optional size variant */
  size?: 'sm' | 'md'
  /** Optional additional className */
  className?: string
}

/**
 * Shuffle icon - two crossing arrows (Spotify-style)
 * Lines start horizontal on left, cross in the middle, end with arrowheads on right
 */
function ShuffleIcon({
  size = 18,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Top path: starts bottom-left, curves up to top-right arrow */}
      <path d="M2 19h3c2 0 3-1.5 5-5s3-7 6-7h4" />
      {/* Top arrowhead */}
      <path d="M18 4l4 3-4 3" />
      {/* Bottom path: starts top-left, curves down to bottom-right arrow */}
      <path d="M2 5h3c3 0 3 1.5 5 5s3 7 6 7h4" />
      {/* Bottom arrowhead */}
      <path d="M18 14l4 3-4 3" />
    </svg>
  )
}

/**
 * Spotify-style shuffle toggle button
 *
 * Visual states:
 * - Inactive: dimmed text color
 * - Active: accent color with subtle glow effect
 *
 * The button provides visual feedback for the shuffle state and
 * supports keyboard navigation for accessibility.
 */
export const ShuffleButton = forwardRef<HTMLButtonElement, ShuffleButtonProps>(
  ({ isActive, onClick, size = 'md', className = '' }, ref) => {
    const sizeClasses = {
      sm: 'w-8 h-8',
      md: 'w-10 h-10',
    }

    const iconSize = size === 'sm' ? 16 : 18

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        aria-label={isActive ? 'Disable shuffle' : 'Enable shuffle'}
        aria-pressed={isActive}
        title={isActive ? 'Shuffle on' : 'Shuffle'}
        className={`
          relative
          ${sizeClasses[size]}
          rounded-full
          flex items-center justify-center
          transition-all duration-200
          focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base
          ${
            isActive
              ? 'text-accent bg-accent/15 shadow-[0_0_12px_rgba(var(--color-accent-rgb),0.4)] hover:bg-accent/25'
              : 'text-text-muted hover:text-white hover:bg-white/10'
          }
          ${className}
        `}
      >
        <ShuffleIcon size={iconSize} />
        {/* Active indicator dot (like Spotify) */}
        {isActive && (
          <span
            className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-accent"
            aria-hidden="true"
          />
        )}
      </button>
    )
  }
)

ShuffleButton.displayName = 'ShuffleButton'
