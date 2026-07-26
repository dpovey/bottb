'use client'

/**
 * Form primitives for the whole app — public pages and admin alike.
 *
 * These replace the former `Admin*` family. There was never a real distinction
 * between an "admin" input and a site input: both are the same dark control on
 * the same accent focus ring, and the two sets had only drifted apart on
 * incidental values (`py-2` vs `py-3`, `bg-white/5` vs `bg-bg`, raw greys vs
 * design tokens). The styling here is the canonical one documented under "Form
 * Inputs" in DESIGN.md, which the site's filter controls already followed.
 *
 * Density is a `size` prop rather than a separate component: `md` is the
 * standard control, `sm` is for the dense table toolbars in admin.
 */

import {
  forwardRef,
  useId,
  ReactNode,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

/** Control density. `md` is the default; `sm` suits dense table toolbars. */
export type FieldSize = 'sm' | 'md'

const SIZES: Record<FieldSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-3 text-sm',
}

/**
 * Chevron placement per size, for `Select`.
 *
 * The chevron is a background image, so it is positioned by its left edge
 * while the text is positioned by the padding box — set both to the same
 * number and the chevron reads as inset further than the text, because half
 * its own width is added on. These offsets put the chevron's *optical centre*
 * on the field's horizontal padding (12px at `sm`, 16px at `md`) given the
 * 1.25em glyph. `pr` then keeps the text clear of it.
 */
const SELECT_CHEVRON: Record<FieldSize, string> = {
  sm: 'pr-7 bg-position-[right_0.25rem_center]',
  md: 'pr-8 bg-position-[right_0.5rem_center]',
}

/** Shared skin: surface, border, focus ring, and disabled treatment. */
function fieldClasses(
  size: FieldSize,
  hasError: boolean | undefined,
  className: string | undefined
): string {
  return cn(
    'w-full rounded-lg bg-bg border text-white placeholder:text-text-dim',
    'transition-colors focus:outline-hidden',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    SIZES[size],
    hasError
      ? 'border-error focus:border-error'
      : 'border-white/10 hover:border-white/20 focus:border-accent',
    className
  )
}

/* =============================================================================
 * FormField - label, error, and helper text around a control
 * ============================================================================= */

export interface FormFieldProps {
  /** Field label */
  label: string
  /** Whether the field is required (shows asterisk) */
  required?: boolean
  /** Error message to display; replaces the helper text while present */
  error?: string
  /** Helper text below the control */
  helperText?: string
  /** Additional class names for the container */
  className?: string
  /** The form control element */
  children: ReactNode
}

/**
 * Wraps a control with consistent label, error, and helper text.
 *
 * ```tsx
 * <FormField label="Email" required error={errors.email}>
 *   <Input type="email" value={email} onChange={...} />
 * </FormField>
 * ```
 */
export function FormField({
  label,
  required,
  error,
  helperText,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-sm font-medium text-text-muted">
        {label}
        {required && <span className="text-error ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-sm text-error">{error}</p>}
      {helperText && !error && (
        <p className="text-xs text-text-dim">{helperText}</p>
      )}
    </div>
  )
}

/* =============================================================================
 * Input
 * ============================================================================= */

export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className' | 'size'
> {
  /** Additional class names */
  className?: string
  /** Whether the control has an error */
  hasError?: boolean
  /** Control density */
  size?: FieldSize
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, size = 'md', ...props }, ref) => (
    <input
      ref={ref}
      className={fieldClasses(size, hasError, className)}
      {...props}
    />
  )
)
Input.displayName = 'Input'

/* =============================================================================
 * Select
 * ============================================================================= */

/** Chevron drawn as a background image, so the native arrow can be dropped. */
const CHEVRON =
  "bg-[url('data:image/svg+xml,%3csvg%20xmlns%3d%27http%3a%2f%2fwww.w3.org%2f2000%2fsvg%27%20fill%3d%27none%27%20viewBox%3d%270%200%2020%2020%27%3e%3cpath%20stroke%3d%27%23666666%27%20stroke-linecap%3d%27round%27%20stroke-linejoin%3d%27round%27%20stroke-width%3d%271.5%27%20d%3d%27M6%208l4%204%204-4%27%2f%3e%3c%2fsvg%3e')]"

export interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'className' | 'size'
> {
  /** Additional class names */
  className?: string
  /** Whether the control has an error */
  hasError?: boolean
  /** Control density */
  size?: FieldSize
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, hasError, size = 'md', children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        fieldClasses(size, hasError, undefined),
        'appearance-none',
        CHEVRON,
        'bg-size-[1.25em_1.25em] bg-no-repeat',
        SELECT_CHEVRON[size],
        'filter-select',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
)
Select.displayName = 'Select'

/* =============================================================================
 * Textarea
 * ============================================================================= */

export interface TextareaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'className' | 'size'
> {
  /** Additional class names */
  className?: string
  /** Whether the control has an error */
  hasError?: boolean
  /** Control density */
  size?: FieldSize
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, hasError, size = 'md', ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        fieldClasses(size, hasError, undefined),
        'resize-none',
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'

/* =============================================================================
 * Combobox - Input with suggestions; free text always allowed
 * ============================================================================= */

/** A suggestion offered by {@link Combobox}. */
export interface ComboboxOption {
  /** Written into the field when picked. */
  value: string
  /** Optional hint shown beside the value in the dropdown (e.g. the artist). */
  label?: string
}

export interface ComboboxProps extends Omit<InputProps, 'list'> {
  /** Suggestions to offer. Plain strings are treated as bare values. */
  options: ReadonlyArray<string | ComboboxOption>
}

/**
 * An {@link Input} backed by a native `<datalist>`, so the field suggests known
 * values but still accepts anything typed. Use it where a `<select>` would be
 * too strict — picking a setlist song, say, while leaving room for a title
 * that is not in the setlist yet.
 *
 * The `<datalist>` id comes from `useId`, so several comboboxes can share a
 * page without the caller inventing unique ids.
 */
export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(
  ({ options, ...inputProps }, ref) => {
    const listId = useId()
    return (
      <>
        <Input ref={ref} list={listId} {...inputProps} />
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
Combobox.displayName = 'Combobox'

/* =============================================================================
 * Checkbox - box with an inline, clickable label
 * ============================================================================= */

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className' | 'type'
> {
  /**
   * Text shown beside the box; the whole thing is then clickable. Omit it for
   * a bare box — a table's select-all, say — and pass `aria-label` instead.
   */
  label?: ReactNode
  /** Additional class names, applied to the label when there is one. */
  className?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className, ...inputProps }, ref) => {
    const box = (
      <input
        ref={ref}
        type="checkbox"
        className={cn('accent-accent', label ? undefined : className)}
        {...inputProps}
      />
    )
    if (!label) return box
    return (
      <label
        className={cn(
          'flex cursor-pointer items-center gap-2 text-text-muted',
          inputProps.disabled && 'cursor-not-allowed opacity-50',
          className
        )}
      >
        {box}
        {label}
      </label>
    )
  }
)
Checkbox.displayName = 'Checkbox'

/* =============================================================================
 * Radio - button with an inline, clickable label
 * ============================================================================= */

export interface RadioProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className' | 'type'
> {
  /** Text shown beside the button; the whole thing is clickable. */
  label: ReactNode
  /** Additional class names, applied to the wrapping label. */
  className?: string
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ label, className, ...inputProps }, ref) => (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2 text-text-muted',
        inputProps.disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      <input ref={ref} type="radio" className="accent-accent" {...inputProps} />
      {label}
    </label>
  )
)
Radio.displayName = 'Radio'

/* =============================================================================
 * Range - slider, used for video scrubbing in the media generators
 * ============================================================================= */

export interface RangeProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className' | 'type'
> {
  /** Additional class names */
  className?: string
}

export const Range = forwardRef<HTMLInputElement, RangeProps>(
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
Range.displayName = 'Range'
