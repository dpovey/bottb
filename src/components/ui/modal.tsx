'use client'

import {
  useEffect,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { CloseIcon } from '@/components/icons'

export interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when modal should close */
  onClose: () => void
  /** Modal title (optional - renders in header) */
  title?: string
  /** Modal description (optional - renders below title) */
  description?: string
  /** Modal content */
  children: ReactNode
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /** Whether clicking backdrop closes modal (default: true) */
  closeOnBackdropClick?: boolean
  /** Whether pressing Escape closes modal (default: true) */
  closeOnEscape?: boolean
  /** Whether to show close button (default: true) */
  showCloseButton?: boolean
  /** Whether modal is disabled (prevent close actions) */
  disabled?: boolean
  /** Additional class names for the modal content */
  className?: string
  /** Footer content (buttons, etc.) */
  footer?: ReactNode
}

/**
 * Reusable Modal component with consistent styling and behavior.
 *
 * Usage:
 * ```tsx
 * <Modal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   title="Confirm Action"
 *   description="Are you sure you want to proceed?"
 *   footer={
 *     <div className="flex gap-3 justify-end">
 *       <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
 *       <Button variant="accent" onClick={handleConfirm}>Confirm</Button>
 *     </div>
 *   }
 * >
 *   <p>Modal body content here</p>
 * </Modal>
 * ```
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  disabled = false,
  className,
  footer,
}: ModalProps) {
  // Handle escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent | globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape && !disabled) {
        onClose()
      }
    },
    [closeOnEscape, disabled, onClose]
  )

  // Handle backdrop click
  const handleBackdropClick = useCallback(() => {
    if (closeOnBackdropClick && !disabled) {
      onClose()
    }
  }, [closeOnBackdropClick, disabled, onClose])

  // Add/remove event listeners and body scroll lock
  useEffect(() => {
    if (!isOpen) return

    // Lock body scroll
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Add keyboard listener
    const handleEscape = (event: globalThis.KeyboardEvent) =>
      handleKeyDown(event)
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, handleKeyDown])

  // Don't render if not open
  if (!isOpen) return null

  // Size classes
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw] max-h-[90vh]',
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-xs"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        className={cn(
          'relative bg-bg-elevated rounded-xl border border-white/10 w-full shadow-2xl',
          'flex flex-col max-h-[90vh]',
          sizeClasses[size],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between px-6 py-4 border-b border-white/5 shrink-0">
            <div>
              {title && (
                <h2
                  id="modal-title"
                  className="font-semibold text-xl text-white"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id="modal-description"
                  className="text-sm text-text-muted mt-1"
                >
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                disabled={disabled}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-text-muted hover:text-white disabled:opacity-50 disabled:cursor-not-allowed -mr-2 -mt-1"
                aria-label="Close modal"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-white/5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  // Render in portal to avoid z-index issues
  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body)
  }

  return modalContent
}

/**
 * Confirmation modal variant for destructive actions.
 */
export interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  isLoading?: boolean
  variant?: 'danger' | 'warning' | 'default'
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isLoading = false,
  variant = 'default',
}: ConfirmModalProps) {
  const iconColors = {
    danger: 'bg-error/20 text-error',
    warning: 'bg-warning/20 text-warning',
    default: 'bg-accent/20 text-accent',
  }

  const buttonColors = {
    danger: 'bg-error hover:bg-error-light',
    warning: 'bg-warning hover:bg-warning-light text-black',
    default: 'bg-accent hover:bg-accent-light',
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" disabled={isLoading}>
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center shrink-0',
            iconColors[variant]
          )}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-lg text-white mb-1">{title}</h3>
          <p className="text-text-muted text-sm">{message}</p>
        </div>
      </div>

      <div className="flex gap-3 justify-end mt-6">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="px-5 py-2 rounded-lg text-sm border border-white/30 hover:border-white/60 hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className={cn(
            'px-5 py-2 rounded-lg text-sm text-white transition-colors disabled:opacity-50 flex items-center gap-2',
            buttonColors[variant]
          )}
        >
          {isLoading && (
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
