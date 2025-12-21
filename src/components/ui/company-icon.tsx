'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { BuildingIcon } from '@/components/icons'

interface CompanyIconProps {
  /** Company icon URL */
  iconUrl?: string | null
  /** Company logo URL (fallback if no icon) */
  logoUrl?: string | null
  /** Company name for alt text */
  companyName: string
  /** Size of the icon */
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Additional classes */
  className?: string
  /** Whether to show a fallback icon when no image is available */
  showFallback?: boolean
}

const sizeClasses = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
}

const sizePixels = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
}

/**
 * Company icon component that displays the company's icon or logo
 * Falls back to a building icon if no image is available
 * Uses Next.js Image component for optimization with proper sizing
 */
export function CompanyIcon({
  iconUrl,
  logoUrl,
  companyName,
  size = 'sm',
  className,
  showFallback = true,
}: CompanyIconProps) {
  const imageUrl = iconUrl || logoUrl
  const pixelSize = sizePixels[size]

  if (!imageUrl) {
    if (!showFallback) {
      return null
    }
    // Fallback to building icon
    return (
      <div
        className={cn(
          'rounded-sm flex items-center justify-center bg-white/10',
          sizeClasses[size],
          className
        )}
        title={companyName}
      >
        <BuildingIcon className="w-3/4 h-3/4 text-text-dim" />
      </div>
    )
  }

  return (
    <Image
      src={imageUrl}
      alt={`${companyName} logo`}
      title={companyName}
      width={pixelSize}
      height={pixelSize}
      className={cn('object-contain rounded-sm', sizeClasses[size], className)}
      unoptimized
      loading="lazy"
    />
  )
}
