'use client'

import { forwardRef, HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { SearchIcon, CloseIcon } from '@/components/icons'
import { Input, Select, type InputProps, type SelectProps } from './form'

/* =============================================================================
 * FilterBar - Container for filter components
 * ============================================================================= */

export interface FilterBarProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

const FilterBar = forwardRef<HTMLDivElement, FilterBarProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-bg-elevated rounded-xl p-4 border border-white/5',
          className
        )}
        {...props}
      >
        <div className="flex flex-wrap gap-4">{children}</div>
      </div>
    )
  }
)
FilterBar.displayName = 'FilterBar'

/* =============================================================================
 * FilterSelect - Styled dropdown select
 * ============================================================================= */

export interface FilterSelectProps extends SelectProps {
  label?: string
  /** Wrapping container class */
  containerClassName?: string
}

/**
 * A filter-bar dropdown: the shared {@link Select} plus the bar's own label
 * and flex sizing. The control itself carries no styling of its own — it used
 * to duplicate the field skin and the chevron, which is how the two drifted
 * apart on chevron placement.
 */
const FilterSelect = forwardRef<HTMLSelectElement, FilterSelectProps>(
  ({ containerClassName, label, children, ...props }, ref) => {
    return (
      <div className={cn('flex-1 min-w-[180px]', containerClassName)}>
        {label && (
          <label className="block text-[10px] tracking-widest uppercase text-text-dim mb-2">
            {label}
          </label>
        )}
        <Select ref={ref} {...props}>
          {children}
        </Select>
      </div>
    )
  }
)
FilterSelect.displayName = 'FilterSelect'

/* =============================================================================
 * FilterSearch - Search input with icon
 * ============================================================================= */

export interface FilterSearchProps extends Omit<InputProps, 'type'> {
  label?: string
  /** Wrapping container class */
  containerClassName?: string
  /** Show clear button when value exists */
  onClear?: () => void
}

const FilterSearch = forwardRef<HTMLInputElement, FilterSearchProps>(
  ({ className, containerClassName, label, onClear, value, ...props }, ref) => {
    return (
      <div className={cn('flex-1 min-w-[240px]', containerClassName)}>
        {label && (
          <label className="block text-[10px] tracking-widest uppercase text-text-dim mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {/* Search icon */}
          <SearchIcon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none"
            strokeWidth={2}
          />
          {/* Padding overrides make room for the icon and the clear button. */}
          <Input
            ref={ref}
            type="text"
            value={value}
            className={cn('pl-10 pr-10', className)}
            {...props}
          />
          {/* Clear button */}
          {value && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <CloseIcon size={16} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    )
  }
)
FilterSearch.displayName = 'FilterSearch'

/* =============================================================================
 * FilterPill - Active filter indicator with remove button
 * ============================================================================= */

export interface FilterPillProps extends HTMLAttributes<HTMLSpanElement> {
  /** Filter label to display */
  children: ReactNode
  /** Called when the remove button is clicked */
  onRemove?: () => void
}

const FilterPill = forwardRef<HTMLSpanElement, FilterPillProps>(
  ({ className, children, onRemove, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1 bg-accent/15 rounded-full text-xs text-accent',
          className
        )}
        {...props}
      >
        {children}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="hover:text-white transition-colors"
            aria-label={`Remove ${children} filter`}
          >
            ×
          </button>
        )}
      </span>
    )
  }
)
FilterPill.displayName = 'FilterPill'

/* =============================================================================
 * FilterPills - Container for active filter pills
 * ============================================================================= */

export interface FilterPillsProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

const FilterPills = forwardRef<HTMLDivElement, FilterPillsProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/5',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
FilterPills.displayName = 'FilterPills'

/* =============================================================================
 * FilterClearButton - Clear all filters button
 * ============================================================================= */

export interface FilterClearButtonProps extends HTMLAttributes<HTMLButtonElement> {
  disabled?: boolean
}

const FilterClearButton = forwardRef<HTMLButtonElement, FilterClearButtonProps>(
  ({ className, disabled, children = 'Clear', ...props }, ref) => {
    return (
      <div className="flex items-end">
        <button
          ref={ref}
          type="button"
          disabled={disabled}
          className={cn(
            'border border-white/30 hover:border-white/60 hover:bg-white/5',
            'px-4 py-3 rounded-lg text-xs tracking-widest uppercase',
            'transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
            className
          )}
          {...props}
        >
          {children}
        </button>
      </div>
    )
  }
)
FilterClearButton.displayName = 'FilterClearButton'

/* =============================================================================
 * Exports
 * ============================================================================= */

export {
  FilterBar,
  FilterSelect,
  FilterSearch,
  FilterPill,
  FilterPills,
  FilterClearButton,
}
