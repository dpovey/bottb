'use client'

import { SearchIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

interface SearchTriggerProps {
  onClick: () => void
  className?: string
  /** Show keyboard shortcut hint */
  showShortcut?: boolean
  /** Variant for different placements */
  variant?: 'icon' | 'button' | 'compact'
}

/**
 * Search trigger button that opens the search dialog.
 * Can be used as an icon button in the header or as a full search bar.
 */
export function SearchTrigger({
  onClick,
  className,
  showShortcut = true,
  variant = 'button',
}: SearchTriggerProps) {
  // Detect Mac for keyboard shortcut display
  const isMac =
    typeof navigator !== 'undefined' &&
    navigator.platform.toUpperCase().indexOf('MAC') >= 0

  if (variant === 'icon') {
    return (
      <button
        onClick={onClick}
        className={cn(
          'p-2 text-text-muted hover:text-white transition-colors rounded-lg hover:bg-white/5',
          className
        )}
        aria-label="Search"
      >
        <SearchIcon className="w-5 h-5" />
      </button>
    )
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={onClick}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted hover:text-white',
          'rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all',
          className
        )}
        aria-label="Search"
      >
        <SearchIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Search</span>
        {showShortcut && (
          <kbd className="hidden sm:inline text-xs px-1.5 py-0.5 rounded bg-white/10 text-text-dim ml-1">
            {isMac ? '⌘K' : 'Ctrl+K'}
          </kbd>
        )}
      </button>
    )
  }

  // Default "button" variant - looks like a search input
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 w-full max-w-md px-4 py-2.5',
        'text-text-muted hover:text-text',
        'rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5',
        'transition-all group',
        className
      )}
      aria-label="Search"
    >
      <SearchIcon className="w-5 h-5 text-text-dim group-hover:text-text-muted transition-colors" />
      <span className="flex-1 text-left text-sm">Search...</span>
      {showShortcut && (
        <kbd className="text-xs px-2 py-1 rounded bg-white/10 text-text-dim">
          {isMac ? '⌘K' : 'Ctrl+K'}
        </kbd>
      )}
    </button>
  )
}
