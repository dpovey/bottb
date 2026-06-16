import { forwardRef, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'error' | 'success' | 'warning' | 'info'
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          // Base styles
          'inline-flex items-center px-3 py-1 rounded-sm text-xs font-medium tracking-wider uppercase',

          // Legibility on busy/photo backgrounds: a dark text-shadow lifts the
          // text off bright areas, and the backdrop blur softens whatever shows
          // through the translucent pill. Variants below use the brighter
          // `*-light` token for text so coloured labels stay readable on dark
          // backgrounds (mid-blue/gold on near-black was the failure case).
          'backdrop-blur-md [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]',

          // Variant styles
          {
            // Default - outline style
            'bg-white/10 border border-white/25 text-white':
              variant === 'default',

            // Accent - for winners, featured, selected
            'bg-accent/25 border border-accent/40 text-accent-light':
              variant === 'accent',

            // Error - for errors, cancelled
            'bg-error/25 border border-error/40 text-error-light':
              variant === 'error',

            // Success - for completed, confirmed
            'bg-success/25 border border-success/40 text-success-light':
              variant === 'success',

            // Warning - for attention needed
            'bg-warning/25 border border-warning/40 text-warning-light':
              variant === 'warning',

            // Info - for informational
            'bg-info/25 border border-info/40 text-info-light':
              variant === 'info',
          },

          className
        )}
        {...props}
      />
    )
  }
)

Badge.displayName = 'Badge'

export { Badge }
