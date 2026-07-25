'use client'

import {
  forwardRef,
  useId,
  ReactNode,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

/* =============================================================================
 * AdminFormField - Reusable form field with label, input, and optional error
 * ============================================================================= */

export interface AdminFormFieldProps {
  /** Field label */
  label: string
  /** Whether the field is required (shows asterisk) */
  required?: boolean
  /** Error message to display */
  error?: string
  /** Helper text below the input */
  helperText?: string
  /** Additional class names for the container */
  className?: string
  /** The form control element */
  children: ReactNode
}

/**
 * Wraps a form control with consistent label, error, and helper text styling.
 *
 * Usage:
 * ```tsx
 * <AdminFormField label="Email" required error={errors.email}>
 *   <AdminInput type="email" value={email} onChange={...} />
 * </AdminFormField>
 * ```
 */
export function AdminFormField({
  label,
  required,
  error,
  helperText,
  className,
  children,
}: AdminFormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-sm font-medium text-gray-300">
        {label}
        {required && <span className="text-error ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-sm text-error">{error}</p>}
      {helperText && !error && (
        <p className="text-xs text-gray-500">{helperText}</p>
      )}
    </div>
  )
}

/* =============================================================================
 * AdminInput - Styled text input for admin forms
 * ============================================================================= */

export interface AdminInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className'
> {
  /** Additional class names */
  className?: string
  /** Whether the input has an error */
  hasError?: boolean
}

export const AdminInput = forwardRef<HTMLInputElement, AdminInputProps>(
  ({ className, hasError, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full px-4 py-2 rounded-lg bg-white/5 border text-white placeholder-gray-500',
          'focus:outline-hidden transition-colors',
          hasError
            ? 'border-error focus:border-error'
            : 'border-white/20 focus:border-accent',
          props.disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      />
    )
  }
)
AdminInput.displayName = 'AdminInput'

/* =============================================================================
 * AdminSelect - Styled select dropdown for admin forms
 * ============================================================================= */

export interface AdminSelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'className'
> {
  /** Additional class names */
  className?: string
  /** Whether the select has an error */
  hasError?: boolean
}

export const AdminSelect = forwardRef<HTMLSelectElement, AdminSelectProps>(
  ({ className, hasError, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full px-4 py-2 rounded-lg bg-white/5 border text-white',
          'focus:outline-hidden transition-colors',
          hasError
            ? 'border-error focus:border-error'
            : 'border-white/20 focus:border-accent',
          props.disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      >
        {children}
      </select>
    )
  }
)
AdminSelect.displayName = 'AdminSelect'

/* =============================================================================
 * AdminTextarea - Styled textarea for admin forms
 * ============================================================================= */

export interface AdminTextareaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'className'
> {
  /** Additional class names */
  className?: string
  /** Whether the textarea has an error */
  hasError?: boolean
}

export const AdminTextarea = forwardRef<
  HTMLTextAreaElement,
  AdminTextareaProps
>(({ className, hasError, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full px-4 py-2 rounded-lg bg-white/5 border text-white placeholder-gray-500',
        'focus:outline-hidden transition-colors resize-none',
        hasError
          ? 'border-error focus:border-error'
          : 'border-white/20 focus:border-accent',
        props.disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
})
AdminTextarea.displayName = 'AdminTextarea'

/* =============================================================================
 * AdminCombobox - Text input with suggestions; free text always allowed
 * ============================================================================= */

/** A suggestion offered by {@link AdminCombobox}. */
export interface AdminComboboxOption {
  /** Written into the field when picked. */
  value: string
  /** Optional hint shown beside the value in the dropdown (e.g. the artist). */
  label?: string
}

export interface AdminComboboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className' | 'list'
> {
  /** Suggestions to offer. Plain strings are treated as bare values. */
  options: ReadonlyArray<string | AdminComboboxOption>
  /** Additional class names */
  className?: string
  /** Whether the input has an error */
  hasError?: boolean
}

/**
 * A combobox: an {@link AdminInput} backed by a native `<datalist>`, so the
 * field suggests known values but still accepts anything typed. Use it wherever
 * a `<select>` would be too strict — picking a setlist song, say, while leaving
 * room for a title that isn't in the setlist yet.
 *
 * The `<datalist>` id is generated with `useId`, so several comboboxes can
 * coexist on a page without the caller inventing unique ids.
 */
export const AdminCombobox = forwardRef<HTMLInputElement, AdminComboboxProps>(
  ({ options, ...inputProps }, ref) => {
    const listId = useId()
    return (
      <>
        <AdminInput ref={ref} list={listId} {...inputProps} />
        <datalist id={listId}>
          {options.map((option) => {
            const { value, label } =
              typeof option === 'string'
                ? { value: option, label: undefined }
                : option
            return <option key={value} value={value} label={label} />
          })}
        </datalist>
      </>
    )
  }
)
AdminCombobox.displayName = 'AdminCombobox'

/* =============================================================================
 * AdminCheckbox - Checkbox with an inline label
 * ============================================================================= */

export interface AdminCheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className' | 'type'
> {
  /** Text shown beside the box; the whole thing is clickable. */
  label: ReactNode
  /** Additional class names, applied to the wrapping label. */
  className?: string
}

export const AdminCheckbox = forwardRef<HTMLInputElement, AdminCheckboxProps>(
  ({ label, className, ...inputProps }, ref) => (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2 text-gray-300',
        inputProps.disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      <input
        ref={ref}
        type="checkbox"
        className="accent-accent"
        {...inputProps}
      />
      {label}
    </label>
  )
)
AdminCheckbox.displayName = 'AdminCheckbox'

/* =============================================================================
 * AdminRange - Slider, used for video scrubbing in the media generators
 * ============================================================================= */

export interface AdminRangeProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className' | 'type'
> {
  /** Additional class names */
  className?: string
}

export const AdminRange = forwardRef<HTMLInputElement, AdminRangeProps>(
  ({ className, ...inputProps }, ref) => (
    <input
      ref={ref}
      type="range"
      className={cn(
        'w-full accent-accent',
        inputProps.disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      {...inputProps}
    />
  )
)
AdminRange.displayName = 'AdminRange'
