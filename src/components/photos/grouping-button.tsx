'use client'

import { forwardRef } from 'react'
import { LayersIcon } from '@/components/icons'

interface GroupingButtonProps {
  /** Whether grouping is currently active */
  isActive: boolean
  /** Called when the button is clicked */
  onClick: () => void
  /** Optional size variant */
  size?: 'sm' | 'md'
  /** Optional additional className */
  className?: string
}

/**
 * Toggle button for grouping similar photos.
 * When active, near-duplicate photos are collapsed in the gallery.
 *
 * Visual states:
 * - Inactive: dimmed text color
 * - Active: accent color with subtle glow effect
 *
 * The button provides visual feedback for the grouping state and
 * supports keyboard navigation for accessibility.
 */
export const GroupingButton = forwardRef<
  HTMLButtonElement,
  GroupingButtonProps
>(({ isActive, onClick, size = 'md', className = '' }, ref) => {
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
      aria-label={isActive ? 'Show all photos' : 'Group similar photos'}
      aria-pressed={isActive}
      title={isActive ? 'Grouping on' : 'Group similar photos'}
      className={`
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
      <LayersIcon size={iconSize} />
      {/* Active indicator dot (like Spotify) */}
      {isActive && (
        <span
          className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-accent"
          aria-hidden="true"
        />
      )}
    </button>
  )
})

GroupingButton.displayName = 'GroupingButton'
