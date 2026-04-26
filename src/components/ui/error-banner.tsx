import { cn } from '@/lib/utils'

export interface ErrorBannerProps {
  message: string | null | undefined
  onDismiss?: () => void
  className?: string
}

/**
 * Inline error banner used across admin and auth surfaces.
 *
 * Renders nothing when `message` is empty so callers can pass state
 * directly without conditionals.
 */
export function ErrorBanner({
  message,
  onDismiss,
  className,
}: ErrorBannerProps) {
  if (!message) return null

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start justify-between gap-3 rounded-lg border border-error/50 bg-error/20 px-4 py-3 text-error',
        className
      )}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="text-error/80 hover:text-error transition-colors"
        >
          ×
        </button>
      )}
    </div>
  )
}
