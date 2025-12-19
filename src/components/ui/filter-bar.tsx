"use client";

import { forwardRef, HTMLAttributes, SelectHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SearchIcon, CloseIcon } from "@/components/icons";

/* =============================================================================
 * FilterBar - Container for filter components
 * ============================================================================= */

export interface FilterBarProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const FilterBar = forwardRef<HTMLDivElement, FilterBarProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-bg-elevated rounded-xl p-4 border border-white/5",
          className
        )}
        {...props}
      >
        <div className="flex flex-wrap gap-4">
          {children}
        </div>
      </div>
    );
  }
);
FilterBar.displayName = "FilterBar";

/* =============================================================================
 * FilterSelect - Styled dropdown select
 * ============================================================================= */

export interface FilterSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  /** Wrapping container class */
  containerClassName?: string;
}

const FilterSelect = forwardRef<HTMLSelectElement, FilterSelectProps>(
  ({ className, containerClassName, label, children, ...props }, ref) => {
    return (
      <div className={cn("flex-1 min-w-[180px]", containerClassName)}>
        {label && (
          <label className="block text-[10px] tracking-widest uppercase text-text-dim mb-2">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            // Base styles
            "w-full px-4 py-3 bg-bg border border-white/10 rounded-lg text-white text-sm",
            // Focus & hover states
            "focus:outline-none focus:border-accent hover:border-white/20",
            // Transitions & disabled state
            "transition-colors disabled:opacity-50",
            // Custom dropdown arrow
            "appearance-none",
            "bg-[url('data:image/svg+xml,%3csvg%20xmlns%3d%27http%3a%2f%2fwww.w3.org%2f2000%2fsvg%27%20fill%3d%27none%27%20viewBox%3d%270%200%2020%2020%27%3e%3cpath%20stroke%3d%27%23666666%27%20stroke-linecap%3d%27round%27%20stroke-linejoin%3d%27round%27%20stroke-width%3d%271.5%27%20d%3d%27M6%208l4%204%204-4%27%2f%3e%3c%2fsvg%3e')]",
            "bg-[length:1.25em_1.25em] bg-[right_0.75rem_center] bg-no-repeat",
            // Use Tailwind class for select styling
            "filter-select",
            className
          )}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  }
);
FilterSelect.displayName = "FilterSelect";

/* =============================================================================
 * FilterSearch - Search input with icon
 * ============================================================================= */

export interface FilterSearchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  /** Wrapping container class */
  containerClassName?: string;
  /** Show clear button when value exists */
  onClear?: () => void;
}

const FilterSearch = forwardRef<HTMLInputElement, FilterSearchProps>(
  ({ className, containerClassName, label, onClear, value, ...props }, ref) => {
    return (
      <div className={cn("flex-1 min-w-[240px]", containerClassName)}>
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
          <input
            ref={ref}
            type="text"
            value={value}
            className={cn(
              // Base styles
              "w-full pl-10 pr-10 py-3 bg-bg border border-white/10 rounded-lg text-white text-sm",
              // Placeholder
              "placeholder:text-text-dim",
              // Focus & hover states
              "focus:outline-none focus:border-accent hover:border-white/20",
              // Transitions & disabled state
              "transition-colors disabled:opacity-50",
              className
            )}
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
    );
  }
);
FilterSearch.displayName = "FilterSearch";

/* =============================================================================
 * FilterPill - Active filter indicator with remove button
 * ============================================================================= */

export interface FilterPillProps extends HTMLAttributes<HTMLSpanElement> {
  /** Filter label to display */
  children: ReactNode;
  /** Called when the remove button is clicked */
  onRemove?: () => void;
}

const FilterPill = forwardRef<HTMLSpanElement, FilterPillProps>(
  ({ className, children, onRemove, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1 bg-accent/15 rounded-full text-xs text-accent",
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
    );
  }
);
FilterPill.displayName = "FilterPill";

/* =============================================================================
 * FilterPills - Container for active filter pills
 * ============================================================================= */

export interface FilterPillsProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const FilterPills = forwardRef<HTMLDivElement, FilterPillsProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/5",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
FilterPills.displayName = "FilterPills";

/* =============================================================================
 * FilterClearButton - Clear all filters button
 * ============================================================================= */

export interface FilterClearButtonProps extends HTMLAttributes<HTMLButtonElement> {
  disabled?: boolean;
}

const FilterClearButton = forwardRef<HTMLButtonElement, FilterClearButtonProps>(
  ({ className, disabled, children = "Clear", ...props }, ref) => {
    return (
      <div className="flex items-end">
        <button
          ref={ref}
          type="button"
          disabled={disabled}
          className={cn(
            "border border-white/30 hover:border-white/60 hover:bg-white/5",
            "px-4 py-3 rounded-lg text-xs tracking-widest uppercase",
            "transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
            className
          )}
          {...props}
        >
          {children}
        </button>
      </div>
    );
  }
);
FilterClearButton.displayName = "FilterClearButton";

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
};

