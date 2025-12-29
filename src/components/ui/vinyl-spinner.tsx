import { HTMLAttributes } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export interface VinylSpinnerProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Size variant of the spinner
   * @default 'md'
   */
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
  /**
   * Rotation speed in seconds (33⅓ RPM = 1.8s)
   * @default 1.8
   */
  speed?: number
}

const sizeMap = {
  xxs: 16,
  xs: 32,
  sm: 64,
  md: 128,
  lg: 256,
}

/**
 * Vinyl record spinner component with Battle of the Tech Bands logo.
 *
 * Rotates at authentic 33⅓ RPM speed (1.8 seconds per rotation).
 * Includes a soft shadow that creates a subtle blur effect underneath.
 *
 * Size variants:
 * - xxs: 16px - For very small inline indicators
 * - xs: 32px - For small inline indicators
 * - sm: 64px - For medium inline loading states
 * - md: 128px - Standard size for most loading states
 * - lg: 256px - For prominent loading states or full-page loading
 *
 * @example
 * ```tsx
 * <VinylSpinner size="md" />
 * ```
 */
export function VinylSpinner({
  size = 'md',
  speed = 1.8,
  className,
  ...props
}: VinylSpinnerProps) {
  const spinnerSize = sizeMap[size]

  return (
    <div
      className={cn('inline-block animate-vinyl-spin', className)}
      style={{
        width: spinnerSize,
        height: spinnerSize,
        animationDuration: `${speed}s`,
        filter:
          'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4)) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3))',
      }}
      {...props}
    >
      <Image
        src="/images/vinyl-spinner.png"
        alt="Loading..."
        width={spinnerSize}
        height={spinnerSize}
        className="w-full h-full"
        unoptimized
        aria-hidden="true"
      />
    </div>
  )
}
