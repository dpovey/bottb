'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { BuildingIcon } from '@/components/icons'
import { logoSizes, logoIntrinsicWidths } from '@/lib/logo-utils'

type IconSize = 'xs' | 'sm' | 'md' | 'lg'

interface CompanyIconProps {
  /** Company icon URL */
  iconUrl?: string | null
  /** Company logo URL (fallback if no icon) */
  logoUrl?: string | null
  /** Company name for alt text */
  companyName: string
  /** Size of the icon */
  size?: IconSize
  /** Additional classes */
  className?: string
  /** Whether to show a fallback icon when no image is available */
  showFallback?: boolean
}

const sizeClasses: Record<IconSize, string> = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
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
  const intrinsic = logoIntrinsicWidths.icon[size]
  const sizes = logoSizes.icon[size]

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
      width={intrinsic.width}
      height={intrinsic.height}
      className={cn('object-contain rounded-sm', sizeClasses[size], className)}
      loading="lazy"
      sizes={sizes}
    />
  )
}
