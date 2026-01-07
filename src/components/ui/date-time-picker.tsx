'use client'

import { useId } from 'react'
import { CalendarIcon } from '@/components/icons'

export interface DateTimePickerProps {
  /** Current value as ISO string or Date */
  value: string | Date | null
  /** Called when value changes */
  onChange: (value: string | null) => void
  /** Label text */
  label?: string
  /** Helper text shown below input */
  helperText?: string
  /** Error message */
  error?: string | null
  /** Minimum datetime (ISO string or Date) */
  min?: string | Date
  /** Maximum datetime (ISO string or Date) */
  max?: string | Date
  /** Disabled state */
  disabled?: boolean
  /** Required field */
  required?: boolean
  /** Additional class names */
  className?: string
}

function toDateTimeLocalValue(date: string | Date | null): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''

  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function DateTimePicker({
  value,
  onChange,
  label,
  helperText,
  error,
  min,
  max,
  disabled = false,
  required = false,
  className = '',
}: DateTimePickerProps) {
  const id = useId()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    if (newValue) {
      // Convert back to ISO string
      const date = new Date(newValue)
      onChange(date.toISOString())
    } else {
      onChange(null)
    }
  }

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-300 mb-2"
        >
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <CalendarIcon
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
        />
        <input
          id={id}
          type="datetime-local"
          value={toDateTimeLocalValue(value)}
          onChange={handleChange}
          min={min ? toDateTimeLocalValue(min) : undefined}
          max={max ? toDateTimeLocalValue(max) : undefined}
          disabled={disabled}
          required={required}
          className={`
            w-full pl-10 pr-4 py-3
            bg-white/5 border rounded-lg
            text-white text-sm
            placeholder:text-gray-500
            transition-colors
            focus:outline-hidden focus:border-accent
            disabled:opacity-50 disabled:cursor-not-allowed
            [&::-webkit-calendar-picker-indicator]:filter
            [&::-webkit-calendar-picker-indicator]:invert
            [&::-webkit-calendar-picker-indicator]:opacity-60
            [&::-webkit-calendar-picker-indicator]:hover:opacity-100
            [&::-webkit-calendar-picker-indicator]:cursor-pointer
            ${error ? 'border-error' : 'border-white/20 hover:border-white/30'}
          `}
        />
      </div>

      {helperText && !error && (
        <p className="text-sm text-gray-500 mt-2">{helperText}</p>
      )}

      {error && <p className="text-sm text-error mt-2">{error}</p>}
    </div>
  )
}

/**
 * A DateTimePicker with an optional toggle to enable/disable scheduling.
 * When disabled, the datetime picker is hidden.
 */
export interface SchedulePickerProps extends Omit<
  DateTimePickerProps,
  'label'
> {
  /** Whether scheduling is enabled */
  enabled: boolean
  /** Called when enabled state changes */
  onEnabledChange: (enabled: boolean) => void
  /** Label for the toggle */
  toggleLabel?: string
}

export function SchedulePicker({
  enabled,
  onEnabledChange,
  toggleLabel = 'Schedule for later',
  value,
  onChange,
  ...props
}: SchedulePickerProps) {
  const toggleId = useId()

  const handleToggle = () => {
    const newEnabled = !enabled
    onEnabledChange(newEnabled)
    if (!newEnabled) {
      onChange(null)
    }
  }

  return (
    <div className={props.className}>
      {/* Toggle */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-3 mb-3 group"
      >
        <div
          className={`
            w-10 h-6 rounded-full relative transition-colors
            ${enabled ? 'bg-accent' : 'bg-white/20'}
          `}
        >
          <div
            className={`
              absolute top-1 w-4 h-4 rounded-full bg-white
              transition-transform duration-200
              ${enabled ? 'translate-x-5' : 'translate-x-1'}
            `}
          />
        </div>
        <label
          htmlFor={toggleId}
          className="text-sm font-medium text-gray-300 cursor-pointer group-hover:text-white transition-colors"
        >
          {toggleLabel}
        </label>
      </button>

      {/* DateTime picker (shown when enabled) */}
      {enabled && (
        <DateTimePicker
          value={value}
          onChange={onChange}
          min={new Date().toISOString()}
          {...props}
          className=""
        />
      )}
    </div>
  )
}
