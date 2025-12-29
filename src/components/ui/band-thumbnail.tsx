'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

export interface BandThumbnailProps {
  logoUrl?: string
  heroThumbnailUrl?: string
  bandName: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'hero'
  className?: string
}

const sizeConfig = {
  xs: {
    container: 'w-8 h-8',
    image: 32,
    placeholder: 'text-[10px]',
    initials: 'text-xs font-bold',
  },
  sm: {
    container: 'w-12 h-12',
    image: 48,
    placeholder: 'text-xs',
    initials: 'text-sm font-bold',
  },
  md: {
    container: 'w-14 h-14 md:w-16 md:h-16',
    image: 64,
    placeholder: 'text-xs',
    initials: 'text-lg font-bold',
  },
  lg: {
    container: 'w-16 h-16',
    image: 64,
    placeholder: 'text-xs',
    initials: 'text-xl font-bold',
  },
  xl: {
    container: 'w-24 h-24 md:w-32 md:h-32',
    image: 128,
    placeholder: 'text-sm',
    initials: 'text-2xl md:text-3xl font-bold',
  },
  xxl: {
    container: 'w-40 h-40 sm:w-48 sm:h-48',
    image: 200,
    placeholder: 'text-lg',
    initials: 'text-4xl font-bold',
  },
  hero: {
    container: 'w-32 h-32 md:w-40 md:h-40',
    image: 160,
    placeholder: 'text-lg',
    initials: 'text-5xl md:text-6xl font-bold',
  },
}

/**
 * Generate initials from a band name
 * Takes the first letter of each word, up to 2 characters
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function BandThumbnail({
  logoUrl,
  heroThumbnailUrl,
  bandName,
  size = 'md',
  className,
}: BandThumbnailProps) {
  const config = sizeConfig[size]
  const imageUrl = logoUrl || heroThumbnailUrl
  const isHeroImage = !logoUrl && !!heroThumbnailUrl

  if (imageUrl) {
    return (
      <div
        className={cn(
          config.container,
          'shrink-0 rounded-lg overflow-hidden bg-bg-surface transition-transform duration-200',
          'motion-safe:hover:scale-105',
          size === 'hero' &&
            'rounded-2xl bg-bg-elevated/80 backdrop-blur-sm border border-white/10',
          className
        )}
      >
        <Image
          src={imageUrl}
          alt={`${bandName} ${logoUrl ? 'logo' : 'photo'}`}
          width={config.image}
          height={config.image}
          className={cn(
            'w-full h-full',
            isHeroImage ? 'object-cover' : 'object-contain'
          )}
          sizes={`${config.image}px`}
        />
      </div>
    )
  }

  // Placeholder with initials when no image available
  return (
    <div
      className={cn(
        config.container,
        'shrink-0 rounded-lg overflow-hidden flex items-center justify-center',
        size === 'hero'
          ? 'rounded-2xl bg-linear-to-br from-accent/40 to-purple-600/40 border border-white/10'
          : 'bg-bg-surface',
        className
      )}
    >
      <span className={cn('text-white/90', config.initials)}>
        {getInitials(bandName)}
      </span>
    </div>
  )
}
